/**
 * @file Scenario 01: Chat Completion - Sync - Text response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ScenarioResult } from "./types";

export const runChatSyncText = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output only the text "Hello, World!" without any additional formatting or explanation.';

  const response = await client.chat.completions.create({
    model: "default",
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });

  const output = response.choices?.[0]?.message?.content;

  return {
    scenario: "chat-sync-text",
    success: typeof output === "string" && output.length > 0,
    output,
    rawResponse: response,
  };
};
