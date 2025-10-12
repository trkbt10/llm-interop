/**
 * @file Scenario 15: Responses API - Sync - Text response - With tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ScenarioResult } from "./types";

const tools = [
  {
    type: "function" as const,
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
    strict: null,
  },
];

export const runResponsesSyncTextTool = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'What is the weather like in Tokyo? Use the get_weather tool.';

  const response = await client.responses.create({
    model: "default",
    input: prompt,
    stream: false,
    tools,
  });

  const toolCalls = response.output?.filter((item) => item.type === "function_call");
  const hasToolCall = Array.isArray(toolCalls) && toolCalls.length > 0;

  return {
    scenario: "responses-sync-text-tool",
    success: hasToolCall,
    output: hasToolCall ? JSON.stringify(toolCalls, null, 2) : response.output_text,
    rawResponse: response,
  };
};
