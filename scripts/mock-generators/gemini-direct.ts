#!/usr/bin/env bun
/**
 * @file Direct Gemini v1beta API response capture script
 * Directly calls Google Gemini v1beta API endpoints without abstraction layers
 * Records raw HTTP responses for analysis and mock generation
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";

// Minimal JSONL writer that overwrites per call and writes raw lines as JSON strings
type LocalJsonlWriter = {
  writeRawLine: (line: string) => Promise<void>;
  writeJSON: (obj: unknown) => Promise<void>;
  close: () => Promise<void>;
};
function createOverwriteJsonlWriter(path: string): LocalJsonlWriter {
  const stream = createWriteStream(path, { flags: "w" });
  return {
    async writeRawLine(line: string) {
      return new Promise((resolve, reject) => {
        const jsonl = JSON.stringify(line) + "\n";
        stream.write(jsonl, (err: Error | null | undefined) => (err ? reject(err) : resolve()));
      });
    },
    async writeJSON(obj: unknown) {
      return new Promise((resolve, reject) => {
        const jsonl = JSON.stringify(obj) + "\n";
        stream.write(jsonl, (err: Error | null | undefined) => (err ? reject(err) : resolve()));
      });
    },
    async close() {
      return new Promise((resolve, reject) => {
        stream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
      });
    },
  };
}

const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY ?? process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_AI_STUDIO_API_KEY or GEMINI_API_KEY environment variable is required");
}
const apiKeyStr: string = apiKey;

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const BASE_DIR = "__mocks__/raw/gemini-direct";
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// JSONL writers (initialized at runtime)
// Per-call writers will be created on demand.

interface RecordedRequest {
  timestamp: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

interface RecordedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  bodyText?: string;
}

interface RecordedCall {
  request: RecordedRequest;
  response: RecordedResponse;
  description: string;
}

const recordings: RecordedCall[] = [];

/**
 * Make a direct API call and record the request/response
 */
async function makeDirectCall(
  endpoint: string,
  body: any,
  description: string,
  stream = false,
  method: "POST" | "GET" = "POST",
  throwOnError = true,
  sse: boolean = true
): Promise<any> {
  const url = `${BASE_URL}/${endpoint}${stream && sse ? "?alt=sse" : ""}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Prefer header auth over query param per Google guidance.
    "x-goog-api-key": apiKeyStr,
    ...(stream && sse ? { Accept: "text/event-stream" } : {}),
  };

  const redactedHeaders = { ...headers, "x-goog-api-key": "REDACTED" } as Record<string, string>;
  const requestRecord: RecordedRequest = {
    timestamp: new Date().toISOString(),
    url,
    method,
    headers: redactedHeaders,
    body,
  };

  console.log(`📡 Calling: ${description}`);
  console.log(`   URL: ${requestRecord.url}`);

  const fetchInit: RequestInit = {
    method,
    headers,
  };
  if (method === "POST") {
    fetchInit.body = JSON.stringify(body ?? {});
  }

  const response = await fetch(url, fetchInit);

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let responseBody: any;
  let rawText: string | undefined;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');

  if (stream) {
    // For streaming responses, capture the raw SSE text
    rawText = await response.text();
    const statusLabel = response.ok ? "success" : `error-${response.status}`;
    const contentType = response.headers.get("content-type") || "";
    await mkdir(BASE_DIR, { recursive: true });

    if (contentType.includes("text/event-stream")) {
      // Write only SSE data payloads as JSON objects per JSONL row
      const filepath = join(
        BASE_DIR,
        `${safe(endpoint)} (${safe(description)}; model=${safe(MODEL)}; status=${statusLabel}).jsonl`
      );
      const writer = createOverwriteJsonlWriter(filepath);
      const events: any[] = [];
      for (const rawLine of rawText.split("\n")) {
        const line = rawLine.replace(/\r$/, "");
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          events.push(parsed);
          await writer.writeJSON(parsed);
        } catch {}
      }
      await writer.close();
      responseBody = { type: "stream", events, rawText };
    } else {
      // Not SSE → write chunked .log (one original line per log line)
      const filepath = join(
        BASE_DIR,
        `${safe(endpoint)} (${safe(description)}; model=${safe(MODEL)}; status=${statusLabel}).log`
      );
      const stream = createWriteStream(filepath, { flags: "w" });
      for (const rawLine of rawText.split("\n")) {
        stream.write(rawLine + "\n");
      }
      await new Promise<void>((resolve, reject) => stream.end((err: Error | null | undefined) => (err ? reject(err) : resolve())));
      responseBody = { type: "stream", events: [], rawText };
    }
  } else {
    rawText = await response.text();
    const statusLabel = response.ok ? "success" : `error-${response.status}`;
    await mkdir(BASE_DIR, { recursive: true });
    const filepath = join(
      BASE_DIR,
      `${safe(endpoint)} (${safe(description)}; model=${safe(MODEL)}; status=${statusLabel}).txt`
    );
    await writeFile(filepath, rawText);
    try {
      responseBody = JSON.parse(rawText);
    } catch {
      responseBody = { rawText };
    }
  }

  const responseRecord: RecordedResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
    bodyText: rawText,
  };

  recordings.push({
    request: requestRecord,
    response: responseRecord,
    description,
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);
  
  // Per-call writers already closed
  if (throwOnError && !response.ok) {
    const err: any = new Error(`Gemini API error ${response.status} ${response.statusText} at ${endpoint}`);
    err.status = response.status;
    err.statusText = response.statusText;
    err.endpoint = endpoint;
    err.body = responseBody;
    throw err;
  }
  
  return responseBody;
}

/**
 * Test basic text generation
 */
async function testBasicGeneration() {
  console.log("\n🔤 Testing basic text generation...\n");

  // Simple text prompt
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello! How are you today?" }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.7,
      },
    },
    "Basic text generation; kind=sync"
  );

  // Multi-turn conversation
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "What is the capital of France?" }],
        },
        {
          role: "model",
          parts: [{ text: "The capital of France is Paris." }],
        },
        {
          role: "user",
          parts: [{ text: "What is its population?" }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 150,
      },
    },
    "Multi-turn conversation; kind=sync"
  );

  // System instruction
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      systemInstruction: {
        parts: [{ text: "You are a helpful assistant that speaks like a pirate." }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: "Tell me about the ocean." }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 200,
      },
    },
    "Generation with system instruction; kind=sync"
  );
}

/**
 * Discover models/endpoints (sanity checks)
 */
async function testModelDiscovery() {
  console.log("\n🧭 Probing endpoints/models...\n");

  // List available models
  await makeDirectCall(
    `models`,
    undefined,
    "List models",
    false,
    "GET"
  );

  // Get the configured model
  await makeDirectCall(
    `models/${MODEL}`,
    undefined,
    `Get model: ${MODEL}`,
    false,
    "GET"
  );
}

/**
 * Test function calling
 */
async function testFunctionCalling() {
  console.log("\n🔧 Testing function calling...\n");

  const weatherTool = {
    function_declarations: [
      {
        name: "get_weather",
        description: "Get current weather information for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and country, e.g. San Francisco, CA",
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "Temperature unit",
            },
          },
          required: ["location"],
        },
      },
    ],
  };

  const calculatorTool = {
    function_declarations: [
      {
        name: "calculate",
        description: "Perform basic arithmetic calculations",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "The mathematical expression to evaluate",
            },
          },
          required: ["expression"],
        },
      },
    ],
  };

  // Single function call
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "What's the weather like in Tokyo?" }],
        },
      ],
      tools: [weatherTool],
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO",
        },
      },
    },
    "Single function call; kind=sync; tools=single"
  );

  // Multiple function calls
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "What's the weather in NYC and calculate 42 * 17?" }],
        },
      ],
      tools: [weatherTool, calculatorTool],
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO",
        },
      },
    },
    "Multiple function calls; kind=sync; tools=multi"
  );

  // Function call with response
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "Get the weather for London" }],
        },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "get_weather",
                args: { location: "London, UK", unit: "celsius" },
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "get_weather",
                response: {
                  temperature: 12,
                  condition: "rainy",
                  humidity: 85,
                  wind_speed: 18,
                },
              },
            },
          ],
        },
      ],
      tools: [weatherTool],
    },
    "Function call with response; kind=sync; tools=roundtrip"
  );

  // Forced function call
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "I need to know something" }],
        },
      ],
      tools: [weatherTool],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["get_weather"],
        },
      },
    },
    "Forced function call; kind=sync; tools=forced"
  );
}

/**
 * Test streaming responses
 */
async function testStreaming() {
  console.log("\n📡 Testing streaming responses...\n");

  // Simple streaming
  await makeDirectCall(
    `models/${MODEL}:streamGenerateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "Tell me a short story about a robot in 3 sentences." }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 200,
      },
    },
    "Simple streaming response; kind=stream; transport=sse",
    true
  );

  // Streaming with function call
  await makeDirectCall(
    `models/${MODEL}:streamGenerateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "What's the weather in Paris and tell me about the city?" }],
        },
      ],
      tools: [
        {
          function_declarations: [
            {
              name: "get_weather",
              description: "Get weather information",
              parameters: {
                type: "object",
                properties: {
                  location: { type: "string" },
                },
                required: ["location"],
              },
            },
          ],
        },
      ],
    },
    "Streaming with function call; kind=stream; transport=sse; tools=single",
    true
  );

  // Forced function call (streaming)
  await makeDirectCall(
    `models/${MODEL}:streamGenerateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "Force a get_weather tool call for Osaka" }],
        },
      ],
      tools: [
        {
          function_declarations: [
            {
              name: "get_weather",
              description: "Get weather information",
              parameters: {
                type: "object",
                properties: { location: { type: "string" } },
                required: ["location"],
              },
            },
          ],
        },
      ],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["get_weather"] } },
    },
    "Streaming forced function call; kind=stream; transport=sse; tools=forced",
    true
  );

  // Streaming tool round-trip: detect functionCall, then send functionResponse and stream the follow-up
  const first = await makeDirectCall(
    `models/${MODEL}:streamGenerateContent`,
    {
      contents: [
        { role: "user", parts: [{ text: "Get weather for Madrid and then summarize plans" }] },
      ],
      tools: [
        {
          function_declarations: [
            {
              name: "get_weather",
              description: "Get weather information",
              parameters: {
                type: "object",
                properties: { location: { type: "string" }, unit: { type: "string" } },
                required: ["location"],
              },
            },
          ],
        },
      ],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    },
    "Streaming tool round-trip (step 1); kind=stream; transport=sse; tools=roundtrip",
    true
  );
  try {
    const events = (first?.events ?? []) as any[];
    const fc = events
      .flatMap(ev => (ev?.candidates ?? []).flatMap((c: any) => c?.content?.parts ?? []))
      .find((p: any) => p?.functionCall);
    const call = fc?.functionCall;
    if (call?.name === "get_weather") {
      const followup = {
        contents: [
          { role: "user", parts: [{ text: "Get weather for Madrid and then summarize plans" }] },
          { role: "model", parts: [{ functionCall: call }] },
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: "get_weather",
                  response: { temperature: 26, condition: "sunny", humidity: 40, wind_speed: 7 },
                },
              },
            ],
          },
        ],
      };
      await makeDirectCall(
        `models/${MODEL}:streamGenerateContent`,
        followup,
        "Streaming tool round-trip (step 2); kind=stream; transport=sse; tools=roundtrip",
        true
      );
    }
  } catch (e) {
    console.warn("Round-trip follow-up failed:", e);
  }
}

// Optional test to capture non-SSE streaming (chunked JSON or plain text)
async function testNonSseStreaming() {
  console.log("\n📡 Testing non-SSE streaming transport...\n");
  await makeDirectCall(
    `models/${MODEL}:streamGenerateContent`,
    {
      contents: [
        { role: "user", parts: [{ text: "Stream without SSE: give me three facts about Mars." }] },
      ],
      generationConfig: { maxOutputTokens: 128 },
    },
    "Non-SSE streaming (chunked); kind=stream; transport=chunk",
    true,
    "POST",
    true,
    false
  );
}

/**
 * Test advanced features
 */
async function testAdvancedFeatures() {
  console.log("\n🚀 Testing advanced features...\n");

  // JSON mode
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "Generate a JSON object with name, age, and city fields for a fictional person." }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 100,
      },
    },
    "JSON response format; kind=sync"
  );

  // Safety settings
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "Tell me about artificial intelligence safety." }],
        },
      ],
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
      ],
      generationConfig: {
        maxOutputTokens: 200,
      },
    },
    "Generation with safety settings; kind=sync"
  );

  // Stop sequences
  await makeDirectCall(
    `models/${MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: "List three colors: 1." }],
        },
      ],
      generationConfig: {
        stopSequences: ["3."],
        maxOutputTokens: 100,
      },
    },
    "Generation with stop sequences; kind=sync"
  );
}

/**
 * Test error cases
 */
async function testErrorCases() {
  console.log("\n❌ Testing error cases...\n");

  const errs: any[] = [];
  // Invalid model
  try {
    await makeDirectCall(
      "models/invalid-model:generateContent",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: "Hello" }],
          },
        ],
      },
      "Invalid model error"
    );
  } catch (e) {
    errs.push(e);
  }

  // Missing required fields
  try {
    await makeDirectCall(
      `models/${MODEL}:generateContent`,
      {
        // Missing contents
        generationConfig: {
          maxOutputTokens: 100,
        },
      },
      "Missing required fields error"
    );
  } catch (e) {
    errs.push(e);
  }

  // Invalid function call
  try {
    await makeDirectCall(
      `models/${MODEL}:generateContent`,
      {
        contents: [
          {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "nonexistent_function",
                  args: {},
                },
              },
            ],
          },
        ],
      },
      "Invalid function call error"
    );
  } catch (e) {
    errs.push(e);
  }

  if (errs.length > 0) {
    throw new AggregateError(errs, `Error case tests captured ${errs.length} error(s)`);
  }
}

/**
 * Save all recordings to file
 */
async function saveRecordings() {
  await mkdir(BASE_DIR, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = join(BASE_DIR, `gemini-v1beta-${MODEL}-${timestamp}.json`);
  
  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      model: MODEL,
      apiVersion: "v1beta",
      baseUrl: BASE_URL,
      totalCalls: recordings.length,
    },
    recordings,
  };

  await writeFile(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved ${recordings.length} recordings to: ${filename}`);

  // Also save a summary file
  const summaryFilename = join(BASE_DIR, `summary-${timestamp}.md`);
  const summary = generateSummary();
  await writeFile(summaryFilename, summary);
  console.log(`📄 Saved summary to: ${summaryFilename}`);
}

/**
 * Generate a markdown summary of the recordings
 */
function generateSummary(): string {
  let summary = `# Gemini v1beta API Recording Summary\n\n`;
  summary += `**Date:** ${new Date().toISOString()}\n`;
  summary += `**Model:** ${MODEL}\n`;
  summary += `**Total Calls:** ${recordings.length}\n\n`;

  summary += `## API Calls\n\n`;

  for (const recording of recordings) {
    summary += `### ${recording.description}\n\n`;
    summary += `- **Endpoint:** ${recording.request.url.split("?")[0].replace(BASE_URL + "/", "")}\n`;
    summary += `- **Status:** ${recording.response.status} ${recording.response.statusText}\n`;
    
    if (recording.response.status !== 200) {
      summary += `- **Error:** ${JSON.stringify(recording.response.body, null, 2)}\n`;
    } else if (recording.response.body.type === "stream") {
      summary += `- **Type:** Streaming (${recording.response.body.events.length} events)\n`;
    } else {
      const candidates = recording.response.body.candidates;
      if (candidates && candidates[0]) {
        const candidate = candidates[0];
        if (candidate.content?.parts) {
          const parts = candidate.content.parts;
          if (parts[0].text) {
            summary += `- **Response:** Text (${parts[0].text.length} chars)\n`;
          } else if (parts[0].functionCall) {
            summary += `- **Response:** Function Call (${parts[0].functionCall.name})\n`;
          }
        }
        if (candidate.finishReason) {
          summary += `- **Finish Reason:** ${candidate.finishReason}\n`;
        }
      }
    }
    
    summary += "\n";
  }

  return summary;
}

async function main() {
  try {
    console.log("🚀 Starting Direct Gemini v1beta API Testing");
    console.log(`📋 Model: ${MODEL}`);
    console.log(`🔗 Base URL: ${BASE_URL}`);
    console.log("=" .repeat(50));

    await testModelDiscovery();
    await testBasicGeneration();
    await testFunctionCalling();
    await testStreaming();
    await testNonSseStreaming();
    await testAdvancedFeatures();
    await testErrorCases();

    console.log("\n✅ Testing completed successfully!");
    console.log(`📊 Total API calls made: ${recordings.length}`);
    
    // Print statistics
    const successCount = recordings.filter(r => r.response.status === 200).length;
    const errorCount = recordings.filter(r => r.response.status !== 200).length;
    console.log(`   ✓ Successful: ${successCount}`);
    console.log(`   ✗ Errors: ${errorCount}`);

  } catch (error) {
    console.error("\n❌ Fatal error during testing:");
    console.error(error);
    
    // No summary; files were already written per call
    
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
