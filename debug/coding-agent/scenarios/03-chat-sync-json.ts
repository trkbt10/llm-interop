/**
 * @file Scenario 03: Chat Completion - Sync - JSON response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ScenarioResult } from "./types";

export const runChatSyncJson = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output a JSON object with the structure: {"greeting": "Hello, World!", "language": "en"}';

  const response = await client.chat.completions.create({
    model: "default",
    messages: [{ role: "user", content: prompt }],
    stream: false,
    response_format: { type: "json_object" },
  });

  const output = response.choices?.[0]?.message?.content;
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
    scenario: "chat-sync-json",
    success: jsonValid,
    output,
    rawResponse: response,
  };
};
