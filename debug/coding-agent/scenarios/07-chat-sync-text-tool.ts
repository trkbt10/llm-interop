/**
 * @file Scenario 07: Chat Completion - Sync - Text response - With tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ScenarioResult } from "./types";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get the current weather in a location",
      parameters: {
        type: "object" as const,
        properties: {
          location: {
            type: "string" as const,
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: { type: "string" as const, enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
  },
];

export const runChatSyncTextTool = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'What is the weather like in Tokyo? Use the get_weather tool.';

  const response = await client.chat.completions.create({
    model: "default",
    messages: [{ role: "user", content: prompt }],
    stream: false,
    tools,
  });

  const message = response.choices?.[0]?.message;
  const toolCalls = message?.tool_calls;
  const hasToolCall = Array.isArray(toolCalls) && toolCalls.length > 0;

  return {
    scenario: "chat-sync-text-tool",
    success: hasToolCall,
    output: hasToolCall ? JSON.stringify(toolCalls, null, 2) : message?.content,
    rawResponse: response,
  };
};
