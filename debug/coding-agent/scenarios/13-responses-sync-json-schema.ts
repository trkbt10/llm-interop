/**
 * @file Scenario 13: Responses API - Sync - JSON Schema response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
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

export const runResponsesSyncJsonSchema = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output a greeting in JSON format.';

  const response = await client.responses.create({
    model: "default",
    input: prompt,
    stream: false,
    text: {
      format: {
        type: "json_schema",
        name: "greeting_response",
        schema,
        strict: true,
      },
    },
  });

  const output = response.output_text;
  const jsonValid = (() => {
    if (typeof output !== "string") {
      return false;
    }
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
    scenario: "responses-sync-json-schema",
    success: jsonValid,
    output,
    rawResponse: response,
  };
};
