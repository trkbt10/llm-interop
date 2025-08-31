/**
 * @file Claude-to-OpenAI Responses API debug proxy
 * Intercepts Anthropic SDK HTTP calls via custom fetch and routes them through
 * our Claude→OpenAI adapters:
 *  - Claude MessageCreateParams → OpenAI Responses params
 *  - Call OpenAI (Responses API) via official SDK
 *  - Convert OpenAI results → Claude message / Claude stream events
 */

import Anthropic from "@anthropic-ai/sdk";
import { emulateClaudeEndpoint } from "../../../../src/ports/fetch/claude";
import { createJsonlWriter } from "../../../../src/utils/jsonl/writer";
import { createLogDirectory } from "../../support/log-utils";

// Minimal config via env for debug
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}
const OPENAI_MODEL = process.env.OPENAI_MODEL;
if (!OPENAI_MODEL) {
  throw new Error("OPENAI_MODEL environment variable is required");
}
const model = "claude-sonnet-4-20250514";
if (!model) {
  throw new Error("CLAUDE_MODEL environment variable is required");
}
console.log(`[Claude→OpenAI] model=${model}`);

const anthropic = new Anthropic({
  // Important: baseURL should NOT include "/v1" because the SDK prefixes endpoints with "/v1/...".
  baseURL: "http://claude-openai-proxy.local",
  fetch: emulateClaudeEndpoint({
    provider: { type: "openai", apiKey: OPENAI_API_KEY, model: OPENAI_MODEL },
  }),
});

// When executed directly: perform tests for all scenarios
if (!import.meta.main) {
  throw new Error("This file is intended to be run directly, not imported.");
}

// Create timestamped log directory
const logDir = createLogDirectory("claude-openai");

// Scenario 1: Non-stream
console.log("=== Running Scenario 1: Non-stream ===");
const writer1 = createJsonlWriter(`${logDir}/non-stream.jsonl`);
const res1 = await anthropic.messages.create({
  model,
  messages: [{ role: "user", content: [{ type: "text", text: "Ping from Claude→OpenAI (non-stream)" }] }],
  stream: false,
  max_tokens: 128,
});
await writer1.write(res1);
await writer1.close();
console.log(`✓ Logged to ${logDir}/non-stream.jsonl`);

// Scenario 2: Stream
console.log("=== Running Scenario 2: Stream ===");
const writer2 = createJsonlWriter(`${logDir}/stream.jsonl`);
const stream2 = await anthropic.messages.create({
  model,
  messages: [{ role: "user", content: [{ type: "text", text: "Ping from Claude→OpenAI (stream)" }] }],
  stream: true,
  max_tokens: 128,
});
for await (const chunk of stream2) {
  await writer2.write(chunk);
}
await writer2.close();
console.log(`✓ Logged to ${logDir}/stream.jsonl`);

// Scenario 3: Non-stream with tools
console.log("=== Running Scenario 3: Non-stream with tools ===");
const writer3 = createJsonlWriter(`${logDir}/non-stream-tools.jsonl`);
const res3 = await anthropic.messages.create({
  model,
  messages: [{ role: "user", content: [{ type: "text", text: "What's the weather like? Use the get_weather tool." }] }],
  stream: false,
  max_tokens: 128,
  tools: [
    {
      name: "get_weather",
      description: "Get the current weather in a given location",
      input_schema: {
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
const stream4 = await anthropic.messages.create({
  model,
  messages: [{ role: "user", content: [{ type: "text", text: "What's the weather like? Use the get_weather tool." }] }],
  stream: true,
  max_tokens: 128,
  tools: [
    {
      name: "get_weather",
      description: "Get the current weather in a given location",
      input_schema: {
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
for await (const chunk of stream4) {
  await writer4.write(chunk);
}
await writer4.close();
console.log(`✓ Logged to ${logDir}/stream-tools.jsonl`);
