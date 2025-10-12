/**
 * @file Scenario 04: Chat Completion - Stream - JSON response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ScenarioResult } from "./types";

export const runChatStreamJson = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output a JSON object with the structure: {"greeting": "Hello, World!", "language": "en"}';

  const stream = (await client.chat.completions.create({
    model: "default",
    messages: [{ role: "user", content: prompt }],
    stream: true,
    response_format: { type: "json_object" },
  })) as AsyncIterable<ChatCompletionChunk>;

  const chunks: ChatCompletionChunk[] = [];
  const textParts: string[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
    const delta = chunk.choices?.[0]?.delta;
    if (delta && typeof delta.content === "string") {
      textParts.push(delta.content);
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
    scenario: "chat-stream-json",
    success: jsonValid && chunks.length > 0,
    output,
    rawResponse: chunks,
  };
};
