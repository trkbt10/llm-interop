#!/usr/bin/env bun
/**
 * @file Harmony streaming capture (via Groq OpenAI-compatible Chat API)
 * - Responses風→Harmonyメッセージ→Chat Completions(stream: true)
 * - 受け取ったストリームチャンクをJSONL保存
 * - __mocks__/raw/harmony/chat-stream.jsonl
 */

import OpenAI, { OpenAI as OpenAIClass } from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { prepareJsonlWriter } from "../../src/utils/jsonl/helpers";

import type { ResponseCreateParamsBase } from "../../src/adapters/openai-compatible/responses-emulator/harmony/types";
import { harmonizeResponseParams } from "../../src/adapters/openai-compatible/responses-emulator/harmony/response-to-chat/index";
import { extractChatCompletionParams } from "../../src/adapters/openai-compatible/responses-emulator/harmony/utils/extract-chat-params";
import {
  convertToolsForChat,
  convertToolChoiceForChat,
} from "../../src/adapters/openai-compatible/responses-emulator/responses-adapter/tool-converter";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_TEST_MODEL = process.env.GROQ_TEST_MODEL ?? "gpt-oss:120b";

if (!GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is required");
}

const client: OpenAIClass = new OpenAI({ apiKey: GROQ_API_KEY, baseURL: GROQ_BASE_URL });

const BASE_DIR = "__mocks__/raw/harmony";

type Scenario = {
  name: string;
  params: ResponseCreateParamsBase;
};

const scenarios: Scenario[] = [
  { name: "basic", params: { model: GROQ_TEST_MODEL, input: "What is 12 * 7?" } },
  {
    name: "developer-instructions",
    params: {
      model: GROQ_TEST_MODEL,
      instructions: "Answer concisely in one sentence.",
      input: "Summarize what Harmony format is for gpt-oss.",
    },
  },
  {
    name: "tooling-weather",
    params: {
      model: GROQ_TEST_MODEL,
      input: "What's the weather in Tokyo?",
      tools: [
        {
          type: "function",
          name: "get_weather",
          description: "Get current weather for a location",
          parameters: {
            type: "object",
            properties: { location: { type: "string" }, unit: { type: "string", enum: ["celsius", "fahrenheit"] } },
            required: ["location"],
          },
          strict: false,
        },
      ],
      tool_choice: "auto",
    },
  },
];

async function captureHarmonyChatStreaming(baseDir: string) {
  const { writer } = await prepareJsonlWriter(baseDir, "chat-stream.jsonl");
  if (!writer) return;
  try {
    console.log("🔄 Capturing Harmony Chat Completions (stream) via Groq...");
    for (const s of scenarios) {
      const harmonyMessages = harmonizeResponseParams(s.params, {});
      const messagesForApi = harmonyMessages.map((m) =>
        m.role === "developer" ? { ...m, role: "system" as const } : m,
      );
      const baseChatParams = extractChatCompletionParams(s.params);
      const chatParams: ChatCompletionCreateParams = {
        ...baseChatParams,
        messages: messagesForApi,
        model: s.params.model ?? GROQ_TEST_MODEL,
        stream: true,
      };
      if (s.params.tools && s.params.tools.length > 0) {
        chatParams.tools = convertToolsForChat(s.params.tools);
        chatParams.tool_choice = convertToolChoiceForChat(s.params.tool_choice ?? "auto");
      }

      const stream = await client.chat.completions.create(chatParams);
      for await (const chunk of stream) {
        await writer.write({ scenario: s.name, chunk });
      }
      console.log(`✓ Stream captured: ${s.name}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  } finally {
    await writer.close();
  }
}

async function main() {
  console.log("🚀 Starting Harmony streaming capture (Groq OpenAI-compatible)");
  console.log(`🔗 baseURL=${GROQ_BASE_URL}`);
  console.log(`🤖 model=${GROQ_TEST_MODEL}`);
  await captureHarmonyChatStreaming(BASE_DIR);
  console.log("\n🎉 Harmony streaming capture completed!");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
