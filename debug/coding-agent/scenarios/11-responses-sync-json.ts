/**
 * @file Scenario 11: Responses API - Sync - JSON response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ScenarioResult } from "./types";

export const runResponsesSyncJson = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output a JSON object with the structure: {"greeting": "Hello, World!", "language": "en"}';

  const response = await client.responses.create({
    model: "default",
    input: prompt,
    stream: false,
    text: {
      format: { type: "json_object" },
    },
  });

  const output = response.output_text;
  const jsonValid = (() => {
    if (typeof output !== "string") {
      return false;
    }
    try {
      const parsed = JSON.parse(output);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  })();

  return {
    scenario: "responses-sync-json",
    success: jsonValid,
    output,
    rawResponse: response,
  };
};
