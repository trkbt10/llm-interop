/**
 * @file Scenario 08: Chat Completion - Stream - Text response - With tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
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

export const runChatStreamTextTool = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'What is the weather like in Tokyo? Use the get_weather tool.';

  const stream = (await client.chat.completions.create({
    model: "default",
    messages: [{ role: "user", content: prompt }],
    stream: true,
    tools,
  })) as AsyncIterable<ChatCompletionChunk>;

  const chunks: ChatCompletionChunk[] = [];
  const textParts: string[] = [];
  const toolCallsAccumulator: Record<number, { id?: string; name?: string; arguments?: string }> = {};

  for await (const chunk of stream) {
    chunks.push(chunk);
    const delta = chunk.choices?.[0]?.delta;

    if (delta?.content) {
      textParts.push(delta.content);
    }

    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index ?? 0;
        if (!toolCallsAccumulator[index]) {
          toolCallsAccumulator[index] = {};
        }
        if (toolCall.id) {
          toolCallsAccumulator[index].id = toolCall.id;
        }
        if (toolCall.function?.name) {
          toolCallsAccumulator[index].name = toolCall.function.name;
        }
        if (toolCall.function?.arguments) {
          toolCallsAccumulator[index].arguments =
            (toolCallsAccumulator[index].arguments ?? "") + toolCall.function.arguments;
        }
      }
    }
  }

  const hasToolCall = Object.keys(toolCallsAccumulator).length > 0;
  const output = hasToolCall
    ? JSON.stringify(Object.values(toolCallsAccumulator), null, 2)
    : textParts.join("");

  return {
    scenario: "chat-stream-text-tool",
    success: hasToolCall && chunks.length > 0,
    output,
    rawResponse: chunks,
  };
};
