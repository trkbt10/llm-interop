/**
 * @file OpenAI-to-Gemini conversation continuity test
 * Tests multi-turn conversation with tool execution and context preservation
 * through our OpenAI→Gemini adapters
 */

import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "../../../../src/ports/fetch/openai";
import { createJsonlWriter } from "../../../../src/utils/jsonl/writer";
import { createLogDirectory } from "../../support/log-utils";

// Minimal config via env for debug
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is required");
}
const GOOGLE_MODEL = process.env.GOOGLE_MODEL;
if (!GOOGLE_MODEL) {
  throw new Error("GOOGLE_MODEL environment variable is required");
}

const openai = new OpenAI({
  baseURL: "http://openai-gemini-proxy.local/v1",
  apiKey: "dummy-key", // Required by SDK but unused
  defaultHeaders: { "OpenAI-Beta": "responses-2025-06-21" },
  fetch: emulateOpenAIEndpoint({
    provider: {
      type: "gemini",
      apiKey: GOOGLE_API_KEY,
      model: GOOGLE_MODEL,
    },
  }),
});

// When executed directly: perform conversation continuity test
if (!import.meta.main) {
  throw new Error("This file is intended to be run directly, not imported.");
}

const model = GOOGLE_MODEL;
console.log(`[OpenAI→Gemini] model=${model}`);

// Create timestamped log directory
const logDir = createLogDirectory("openai-gemini");

// Conversation continuity test: Tool execution and follow-up
console.log("=== Running Conversation Continuity Test ===");
const writer = createJsonlWriter(`${logDir}/conversation.jsonl`);

// Build conversation history step by step
const conversationInput: OpenAI.Responses.ResponseInput = [
  { role: "user" as const, content: "What's the weather like in Tokyo? Use the get_weather tool." },
];

// First request with tool
const res_initial = await openai.responses.create({
  model,
  input: conversationInput,
  stream: false,
  max_output_tokens: 128,
  tools: [
    {
      type: "function",
      name: "get_weather",
      description: "Get the current weather in a given location",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
        },
        required: ["location"],
      },
    },
  ],
});
await writer.write({ step: "initial", response: res_initial });

// Add the complete assistant response (including function calls) to conversation history
if (res_initial.output) {
  conversationInput.push(...res_initial.output);
}

// Find the function call in the response to provide tool result
const functionCall = res_initial.output?.find((item) => item.type === "function_call");
if (functionCall && functionCall.type === "function_call") {
  // Add tool execution result - let the adapter handle ID conversion
  conversationInput.push({
    type: "function_call_output",
    call_id: functionCall.call_id,
    output: "Weather in Tokyo: 22°C, partly cloudy with light rain expected in the afternoon.",
  });
}

// Add follow-up question
conversationInput.push({
  role: "user",
  content: "Based on this weather information, should I bring an umbrella?",
});

// Continue conversation with full history
const res_followup = await openai.responses.create({
  model,
  input: conversationInput,
  stream: false,
  max_output_tokens: 128,
});
await writer.write({ step: "followup", response: res_followup });

await writer.close();
console.log(`✓ Logged conversation continuity test to ${logDir}/conversation.jsonl`);
