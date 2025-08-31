/**
 * @file OpenAI-to-Gemini Responses API debug proxy
 * Intercepts OpenAI SDK HTTP calls via custom fetch and routes them through
 * our OpenAI→Gemini adapters:
 *  - OpenAI Responses params → Gemini generateContent params
 *  - Call Gemini API via official SDK
 *  - Convert Gemini results → OpenAI Response format
 */

import OpenAI from "openai";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
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

// When executed directly: perform tests for all scenarios
if (!import.meta.main) {
  throw new Error("This file is intended to be run directly, not imported.");
}

const model = GOOGLE_MODEL;
console.log(`[OpenAI→Gemini] model=${model}`);

// Create timestamped log directory
const logDir = createLogDirectory("openai-gemini");

// Scenario 1: Non-stream
console.log("=== Running Scenario 1: Non-stream ===");
const writer1 = createJsonlWriter(`${logDir}/non-stream.jsonl`);
const res1 = await openai.responses.create({
  model,
  input: "Ping from OpenAI→Gemini (non-stream)",
  stream: false,
  max_output_tokens: 128,
});
await writer1.write(res1);
await writer1.close();
console.log(`✓ Logged to ${logDir}/non-stream.jsonl`);

// Scenario 2: Stream
console.log("=== Running Scenario 2: Stream ===");
const writer2 = createJsonlWriter(`${logDir}/stream.jsonl`);
const stream2 = (await openai.responses.create({
  model,
  input: "Ping from OpenAI→Gemini (stream)",
  stream: true,
  max_output_tokens: 128,
})) as AsyncIterable<ResponseStreamEvent>;
for await (const event of stream2) {
  await writer2.write(event);
}
await writer2.close();
console.log(`✓ Logged to ${logDir}/stream.jsonl`);

// Scenario 3: Non-stream with tools
console.log("=== Running Scenario 3: Non-stream with tools ===");
const writer3 = createJsonlWriter(`${logDir}/non-stream-tools.jsonl`);
const res3 = await openai.responses.create({
  model,
  input: "What's the weather like? Use the get_weather tool.",
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
await writer3.write(res3);
await writer3.close();
console.log(`✓ Logged to ${logDir}/non-stream-tools.jsonl`);

// Scenario 4: Stream with tools
console.log("=== Running Scenario 4: Stream with tools ===");
const writer4 = createJsonlWriter(`${logDir}/stream-tools.jsonl`);
const stream4 = (await openai.responses.create({
  model,
  input: "What's the weather like? Use the get_weather tool.",
  stream: true,
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
})) as AsyncIterable<ResponseStreamEvent>;
for await (const event of stream4) {
  await writer4.write(event);
}
await writer4.close();
console.log(`✓ Logged to ${logDir}/stream-tools.jsonl`);
