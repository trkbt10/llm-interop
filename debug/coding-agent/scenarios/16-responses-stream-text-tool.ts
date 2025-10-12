/**
 * @file Scenario 16: Responses API - Stream - Text response - With tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
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

export const runResponsesStreamTextTool = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'What is the weather like in Tokyo? Use the get_weather tool.';

  const stream = (await client.responses.create({
    model: "default",
    input: prompt,
    stream: true,
    tools,
  })) as AsyncIterable<ResponseStreamEvent>;

  const events: ResponseStreamEvent[] = [];
  const textParts: string[] = [];
  const toolCalls: Array<{ item_id: string; name: string; arguments: string }> = [];

  for await (const event of stream) {
    events.push(event);

    if (event.type === "response.output_text.delta") {
      const deltaEvent = event as Extract<ResponseStreamEvent, { type: "response.output_text.delta" }>;
      textParts.push(deltaEvent.delta);
    }

    if (event.type === "response.function_call_arguments.delta") {
      const deltaEvent = event as Extract<ResponseStreamEvent, { type: "response.function_call_arguments.delta" }>;
      const existingTool = toolCalls.find((t) => t.item_id === deltaEvent.item_id);

      if (existingTool) {
        existingTool.arguments += deltaEvent.delta;
      } else {
        toolCalls.push({
          item_id: deltaEvent.item_id,
          name: "",
          arguments: deltaEvent.delta,
        });
      }
    }

    if (event.type === "response.function_call_arguments.done") {
      const doneEvent = event as Extract<ResponseStreamEvent, { type: "response.function_call_arguments.done" }>;
      const existingTool = toolCalls.find((t) => t.item_id === doneEvent.item_id);

      if (existingTool) {
        existingTool.name = doneEvent.name;
        existingTool.arguments = doneEvent.arguments;
      } else {
        toolCalls.push({
          item_id: doneEvent.item_id,
          name: doneEvent.name,
          arguments: doneEvent.arguments,
        });
      }
    }
  }

  const hasToolCall = toolCalls.length > 0;
  const output = hasToolCall ? JSON.stringify(toolCalls, null, 2) : textParts.join("");

  return {
    scenario: "responses-stream-text-tool",
    success: hasToolCall && events.length > 0,
    output,
    rawResponse: events,
  };
};
