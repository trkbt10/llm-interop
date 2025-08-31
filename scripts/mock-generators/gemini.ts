#!/usr/bin/env bun
/**
 * @file Gemini real API response capture script
 * Captures actual Google Gemini API responses
 * Supports both streaming and non-streaming with function calls
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createJsonlWriter } from "../../src/utils/jsonl/writer";
import { GeminiFetchClient } from "../../src/providers/gemini/client/fetch-client";

const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY ?? process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_AI_STUDIO_API_KEY or GEMINI_API_KEY environment variable is required");
}

const client = new GeminiFetchClient({ apiKey });

const BASE_DIR = "__mocks__/raw/gemini";
const MODEL = process.env.GEMINI_MODEL;
if (!MODEL) {
  throw new Error("GEMINI_MODEL environment variable is required");
}

// Type assertion to ensure MODEL is string after the check
const model: string = MODEL;

const testMessages = [
  "Hello! How are you today?",
  "What's the weather like in San Francisco?",
  "Can you help me calculate 15 * 23?",
  "Tell me a short story about a robot.",
];

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
            description: "The mathematical expression to evaluate, e.g. '15 * 23'",
          },
        },
        required: ["expression"],
      },
    },
  ],
};

async function captureMessageResponses(baseDir: string, model: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }
  if (!model) {
    throw new Error("model is required");
  }

  await mkdir(baseDir, { recursive: true });

  const writer = createJsonlWriter(join(baseDir, "message-sync.jsonl"));

  try {
    console.log("🔄 Capturing Gemini Messages (sync)...");

    // Simple text responses
    for (const message of testMessages) {
      const response = await client.generateContent(model, {
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });
      await writer.write(response);
      console.log(`✓ Captured simple response: ${message.slice(0, 30)}...`);
    }

    // Function call response
    const toolResponse = await client.generateContent(model, {
      contents: [
        {
          role: "user",
          parts: [{ text: "What's the weather like in Tokyo?" }],
        },
      ],
      tools: [weatherTool],
      generationConfig: {},
    });
    await writer.write(toolResponse);
    console.log("✓ Captured function call response");

    // Multi-function call response
    const multiToolResponse = await client.generateContent(model, {
      contents: [
        {
          role: "user",
          parts: [{ text: "What's the weather in NYC and calculate 42 * 17?" }],
        },
      ],
      tools: [weatherTool, calculatorTool],
      generationConfig: {},
    });
    await writer.write(multiToolResponse);
    console.log("✓ Captured multi-function response");

    // Function response (tool result)
    const functionResponseMessage = await client.generateContent(model, {
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
          role: "function",
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
      generationConfig: {},
    });
    await writer.write(functionResponseMessage);
    console.log("✓ Captured function response message");
  } finally {
    await writer.close();
  }
}

async function captureStreamingResponses(baseDir: string, model: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }
  if (!model) {
    throw new Error("model is required");
  }

  const writer = createJsonlWriter(join(baseDir, "message-stream.jsonl"));

  try {
    console.log("🔄 Capturing Gemini Messages (streaming)...");

    // Simple streaming
    const stream = client.streamGenerateParts(model, {
      contents: [
        {
          role: "user",
          parts: [{ text: "Tell me a story about artificial intelligence in 3 paragraphs." }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    for await (const part of stream) {
      await writer.write(part);
    }
    console.log("✓ Captured simple streaming response");

    // Function call streaming
    const toolStream = client.streamGenerateParts(model, {
      contents: [
        {
          role: "user",
          parts: [{ text: "Get the weather for Paris, France and explain what the conditions mean" }],
        },
      ],
      tools: [weatherTool],
      generationConfig: {},
    });

    for await (const part of toolStream) {
      await writer.write(part);
    }
    console.log("✓ Captured function call streaming response");

    // Multi-function streaming
    const multiStream = client.streamGenerateParts(model, {
      contents: [
        {
          role: "user",
          parts: [{ text: "Check weather in Berlin and calculate the square root of 144, then explain both results" }],
        },
      ],
      tools: [weatherTool, calculatorTool],
      generationConfig: {},
    });

    for await (const part of multiStream) {
      await writer.write(part);
    }
    console.log("✓ Captured multi-function streaming response");
  } finally {
    await writer.close();
  }
}

async function main() {
  try {
    console.log("🚀 Starting Gemini API response capture...");
    console.log(`📋 Using model: ${model}\n`);

    await captureMessageResponses(BASE_DIR, model);
    await captureStreamingResponses(BASE_DIR, model);

    console.log("\n🎉 Gemini API response capture completed successfully!");
  } catch (error) {
    console.error("❌ Failed to capture Gemini API responses:");
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
