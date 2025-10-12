/**
 * @file Scenario 12: Responses API - Stream - JSON response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { ScenarioResult } from "./types";

export const runResponsesStreamJson = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output a JSON object with the structure: {"greeting": "Hello, World!", "language": "en"}';

  const stream = (await client.responses.create({
    model: "default",
    input: prompt,
    stream: true,
    text: {
      format: { type: "json_object" },
    },
  })) as AsyncIterable<ResponseStreamEvent>;

  const events: ResponseStreamEvent[] = [];
  const textParts: string[] = [];

  for await (const event of stream) {
    events.push(event);
    if (event.type === "response.output_text.delta") {
      const delta = (event as Extract<ResponseStreamEvent, { type: "response.output_text.delta" }>).delta;
      textParts.push(delta);
    }
  }

  const output = textParts.join("");
  const jsonValid = (() => {
    try {
      const parsed = JSON.parse(output);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  })();

  return {
    scenario: "responses-stream-json",
    success: jsonValid && events.length > 0,
    output,
    rawResponse: events,
  };
};
