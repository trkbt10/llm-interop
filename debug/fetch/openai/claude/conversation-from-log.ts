/**
 * @file Test conversation continuation using actual logged response data
 * Tests the ability to reconstruct conversations from OpenAI Responses API output
 * and continue them with proper tool result handling
 */

import OpenAI from "openai";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { emulateOpenAIEndpoint } from "../../../../src/ports/fetch/openai";
import { createJsonlWriter } from "../../../../src/utils/jsonl/writer";
import { createLogDirectory } from "../../support/log-utils";

// Minimal config via env for debug
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required");
}
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL;
if (!ANTHROPIC_MODEL) {
  throw new Error("ANTHROPIC_MODEL environment variable is required");
}

const openai = new OpenAI({
  baseURL: "http://openai-claude-proxy.local/v1",
  apiKey: "dummy-key",
  defaultHeaders: { "OpenAI-Beta": "responses-2025-06-21" },
  fetch: emulateOpenAIEndpoint({
    provider: {
      type: "claude",
      apiKey: ANTHROPIC_API_KEY,
      model: ANTHROPIC_MODEL,
    },
  }),
});

// When executed directly: test conversation from logged response
if (!import.meta.main) {
  throw new Error("This file is intended to be run directly, not imported.");
}

console.log(`[OpenAI→Claude] model=${ANTHROPIC_MODEL} (from log test)`);

// Create timestamped log directory
const logDir = createLogDirectory("openai-claude-from-log");
const writer = createJsonlWriter(`${logDir}/conversation-from-log.jsonl`);

// Reconstruct conversation from the logged initial response
// Based on: {"step":"initial","response":{"id":"resp_...","output":[...]}}
console.log("=== Building conversation from logged response data ===");

// Simulate the conversation state after initial function call
const conversationInput: OpenAI.Responses.ResponseInput = [
  // Original user message
  { role: "user", content: "What's the weather like in Tokyo? Use the get_weather tool." },

  // Assistant response with function call (reconstructed from log)
  {
    role: "assistant",
    content: "I'll check the current weather in Tokyo for you using the get_weather tool.",
    tool_calls: [
      {
        id: "call_01FTp8yQrcSpvgRfF1rNWXJb",
        type: "function",
        function: {
          name: "get_weather",
          arguments: '{"location":"Tokyo, Japan"}',
        },
      },
    ],
  } as OpenAI.Responses.ResponseInputItem,

  // Tool execution result
  {
    type: "function_call_output",
    call_id: "call_01FTp8yQrcSpvgRfF1rNWXJb",
    output: "Weather in Tokyo: 22°C, partly cloudy with light rain expected in the afternoon.",
  },

  // Follow-up question
  { role: "user", content: "Based on this weather information, should I bring an umbrella?" },
];

// Test conversation continuation with this reconstructed state
console.log("=== Testing conversation continuation ===");

try {
  const stream_followup = (await openai.responses.create({
    model: ANTHROPIC_MODEL,
    input: conversationInput,
    stream: true,
    max_output_tokens: 128,
  })) as AsyncIterable<ResponseStreamEvent>;

  let followupError = false;
  for await (const event of stream_followup) {
    await writer.write({ step: "followup_from_log", event });

    // Check for error events in followup
    if ("error" in event && event.error) {
      console.error(`[ERROR] Followup stream error detected:`, event);
      followupError = true;
      break;
    }
  }

  if (followupError) {
    await writer.close();
    console.log(`❌ Followup request failed due to error`);
    process.exit(1);
  }

  await writer.close();
  console.log(`✓ Successfully tested conversation continuation from logged data`);
  console.log(`✓ Logged to ${logDir}/conversation-from-log.jsonl`);
} catch (error) {
  console.error(`[ERROR] Request failed:`, error);
  await writer.close();
  process.exit(1);
}
