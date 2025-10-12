/**
 * @file Scenario 02: Chat Completion - Stream - Text response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ScenarioResult } from "./types";

export const runChatStreamText = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output only the text "Hello, World!" without any additional formatting or explanation.';

  const stream = (await client.chat.completions.create({
    model: "default",
    messages: [{ role: "user", content: prompt }],
    stream: true,
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

  return {
    scenario: "chat-stream-text",
    success: output.length > 0 && chunks.length > 0,
    output,
    rawResponse: chunks,
  };
};
