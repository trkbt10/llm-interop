/**
 * @file Scenario 09: Responses API - Sync - Text response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ScenarioResult } from "./types";

export const runResponsesSyncText = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output only the text "Hello, World!" without any additional formatting or explanation.';

  const response = await client.responses.create({
    model: "default",
    input: prompt,
    stream: false,
  });

  const output = response.output_text;

  return {
    scenario: "responses-sync-text",
    success: typeof output === "string" && output.length > 0,
    output,
    rawResponse: response,
  };
};
