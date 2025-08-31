/**
 * @file Claude-to-OpenAI conversation continuity test
 * Tests multi-turn conversation with tool execution and context preservation
 * through our Claude→OpenAI adapters
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

// When executed directly: perform conversation continuity test
if (!import.meta.main) {
  throw new Error("This file is intended to be run directly, not imported.");
}

// Create timestamped log directory
const logDir = createLogDirectory("claude-openai");

// Conversation continuity test: Tool execution and follow-up
console.log("=== Running Conversation Continuity Test ===");
const writer = createJsonlWriter(`${logDir}/conversation.jsonl`);

// Build conversation history step by step
const conversationHistory: Anthropic.Messages.MessageParam[] = [
  {
    role: "user" as const,
    content: [{ type: "text" as const, text: "What's the weather like in Tokyo? Use the get_weather tool." }],
  },
];

// First request with tool
const res_initial = await anthropic.messages.create({
  model,
  messages: conversationHistory,
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
await writer.write({ step: "initial", response: res_initial });

// Add assistant response to history
conversationHistory.push({ role: "assistant", content: res_initial.content });

// Find the tool use in the response and continue conversation
const toolUse = res_initial.content.find((c) => c.type === "tool_use");
if (!toolUse || toolUse.type !== "tool_use") {
  throw new Error("Expected tool_use in response but not found");
}

// Add tool result and follow-up question
conversationHistory.push({
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: "Weather in Tokyo: 22°C, partly cloudy with light rain expected in the afternoon.",
    },
    {
      type: "text",
      text: "Based on this weather information, should I bring an umbrella?",
    },
  ],
});

// Continue conversation with full history
const res_followup = await anthropic.messages.create({
  model,
  messages: conversationHistory,
  stream: false,
  max_tokens: 128,
});
await writer.write({ step: "followup", response: res_followup });

await writer.close();
console.log(`✓ Logged conversation continuity test to ${logDir}/conversation.jsonl`);
