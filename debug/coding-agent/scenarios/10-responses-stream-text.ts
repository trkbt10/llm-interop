/**
 * @file Scenario 10: Responses API - Stream - Text response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { ScenarioResult } from "./types";

export const runResponsesStreamText = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output only the text "Hello, World!" without any additional formatting or explanation.';

  const stream = (await client.responses.create({
    model: "default",
    input: prompt,
    stream: true,
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

  return {
    scenario: "responses-stream-text",
    success: output.length > 0 && events.length > 0,
    output,
    rawResponse: events,
  };
};
