/**
 * @file Scenario 14: Responses API - Stream - JSON Schema response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { ScenarioResult } from "./types";

const schema = {
  type: "object" as const,
  properties: {
    greeting: { type: "string" as const },
    language: { type: "string" as const },
  },
  required: ["greeting", "language"],
  additionalProperties: false,
};

export const runResponsesStreamJsonSchema = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output a greeting in JSON format.';

  const stream = (await client.responses.create({
    model: "default",
    input: prompt,
    stream: true,
    text: {
      format: {
        type: "json_schema",
        name: "greeting_response",
        schema,
        strict: true,
      },
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
      return (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof parsed.greeting === "string" &&
        typeof parsed.language === "string"
      );
    } catch {
      return false;
    }
  })();

  return {
    scenario: "responses-stream-json-schema",
    success: jsonValid && events.length > 0,
    output,
    rawResponse: events,
  };
};
