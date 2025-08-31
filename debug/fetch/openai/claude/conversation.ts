/**
 * @file OpenAI-to-Claude conversation continuity test
 * Tests multi-turn conversation with tool execution and context preservation
 * through our OpenAI→Claude adapters
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
  apiKey: "dummy-key", // Required by SDK but unused
  defaultHeaders: { "OpenAI-Beta": "responses-2025-06-21" },
  fetch: emulateOpenAIEndpoint({
    provider: {
      type: "claude",
      apiKey: ANTHROPIC_API_KEY,
      model: ANTHROPIC_MODEL,
    },
  }),
});

// When executed directly: perform conversation continuity test
if (!import.meta.main) {
  throw new Error("This file is intended to be run directly, not imported.");
}

const model = ANTHROPIC_MODEL;
console.log(`[OpenAI→Claude] model=${model}`);

// Create timestamped log directory
const logDir = createLogDirectory("openai-claude");

// Conversation continuity test: Tool execution and follow-up
console.log("=== Running Conversation Continuity Test ===");
const writer = createJsonlWriter(`${logDir}/conversation.jsonl`);

// Build conversation history step by step
const conversationInput: OpenAI.Responses.ResponseInput = [
  { role: "user" as const, content: "What's the weather like in Tokyo? Use the get_weather tool." },
];

// First request with tool
const stream_initial = (await openai.responses.create({
  model,
  input: conversationInput,
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

// Collect initial response and log stream events
const initialOutput: OpenAI.Responses.ResponseOutputItem[] = [];
let functionCall: OpenAI.Responses.ResponseOutputItem | null = null;
let hasError = false;

for await (const event of stream_initial) {
  await writer.write({ step: "initial", event });

  // Check for error events
  if ("error" in event && event.error) {
    console.error(`[ERROR] Stream error detected:`, event);
    hasError = true;
    break;
  }

  if (event.type === "response.output_item.added" && event.item) {
    initialOutput.push(event.item);
    if (event.item.type === "function_call") {
      functionCall = event.item;
    }
  }
}

if (hasError) {
  await writer.close();
  console.log(`❌ Initial request failed due to error`);
  process.exit(1);
}

// Convert function call output items to tool calls for Chat Completions format
interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

const toolCalls: ToolCall[] = [];
let hasText = false;

for (const item of initialOutput) {
  if (item.type === "function_call") {
    toolCalls.push({
      id: item.call_id,
      type: "function",
      function: {
        name: item.name,
        arguments: item.arguments ?? "{}",
      },
    });
  } else if (item.type === "message" && "content" in item) {
    // Handle message content
    hasText = true;
  }
}

// Add assistant message with tool calls to conversation history
if (toolCalls.length > 0) {
  const assistantMessage: OpenAI.Responses.ResponseInputItem = {
    role: "assistant",
    content: hasText ? "I'll check the weather for you." : "",
    tool_calls: toolCalls,
  } as OpenAI.Responses.ResponseInputItem;
  conversationInput.push(assistantMessage);
}

// Add tool execution result if function call was made
if (functionCall && functionCall.type === "function_call") {
  console.log(`[DEBUG] function_call.call_id: ${functionCall.call_id}`);
  conversationInput.push({
    type: "function_call_output",
    call_id: functionCall.call_id,
    output: "Weather in Tokyo: 22°C, partly cloudy with light rain expected in the afternoon.",
  });

  // Add follow-up question
  conversationInput.push({
    role: "user",
    content: "Based on this weather information, should I bring an umbrella?",
  });
}

// Continue conversation with full history
const stream_followup = (await openai.responses.create({
  model,
  input: conversationInput,
  stream: true,
  max_output_tokens: 128,
})) as AsyncIterable<ResponseStreamEvent>;

let followupError = false;
for await (const event of stream_followup) {
  await writer.write({ step: "followup", event });

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
console.log(`✓ Logged conversation continuity test to ${logDir}/conversation.jsonl`);
