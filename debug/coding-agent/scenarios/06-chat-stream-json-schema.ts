/**
 * @file Scenario 06: Chat Completion - Stream - JSON Schema response - No tool calls
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
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

export const runChatStreamJsonSchema = async (client: OpenAICompatibleClient): Promise<ScenarioResult> => {
  const prompt = 'Output a greeting in JSON format.';

  const stream = (await client.chat.completions.create({
    model: "default",
    messages: [{ role: "user", content: prompt }],
    stream: true,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "greeting_response",
        schema,
        strict: true,
      },
    },
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
    scenario: "chat-stream-json-schema",
    success: jsonValid && chunks.length > 0,
    output,
    rawResponse: chunks,
  };
};
