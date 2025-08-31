#!/usr/bin/env bun
/**
 * Verify Responses emulator Harmony conversion/decoding using Groq + gpt-oss:120b.
 *
 * Flow per scenario:
 * - Build Harmony messages from Responses-style params (harmonizeResponseParams)
 * - Send Chat Completions request to Groq (OpenAI-compatible)
 * - Construct HarmonyMessage from the assistant output (no fabrication)
 * - Convert Harmony → OpenAI Responses events (convertHarmonyToResponses)
 * - Log request/response/events to JSONL
 */

import { OpenAI } from "openai";
import type {
  ChatCompletionCreateParams,
  ChatCompletion,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import { isFunctionToolCall } from "../../../src/providers/openai/responses-guards";

import type { ResponseCreateParamsBase } from "../../../src/adapters/openai-compatible/responses-emulator/harmony/types";
import { harmonizeResponseParams } from "../../../src/adapters/openai-compatible/responses-emulator/harmony/response-to-chat";
import { extractChatCompletionParams } from "../../../src/adapters/openai-compatible/responses-emulator/harmony/utils/extract-chat-params";
import {
  convertToolsForChat,
  convertToolChoiceForChat,
} from "../../../src/adapters/openai-compatible/responses-emulator/responses-adapter/tool-converter";

import { createLogDirectory } from "../../fetch/support/log-utils";
import { createJsonlWriter } from "../../../src/utils/jsonl/writer";

import { convertHarmonyToResponses } from "../../../src/adapters/openai-compatible/responses-emulator/harmony/to-responses-response";
import type { HarmonyMessage } from "../../../src/adapters/openai-compatible/responses-emulator/harmony/to-responses-response";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_TEST_MODEL = process.env.GROQ_TEST_MODEL ?? "gpt-oss:120b";

if (!GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is required");
}

const client = new OpenAI({ apiKey: GROQ_API_KEY, baseURL: GROQ_BASE_URL });

type Scenario = {
  name: string;
  description: string;
  params: ResponseCreateParamsBase;
};

async function runScenario(s: Scenario, logDir: string): Promise<void> {
  console.log(`\n📤 [${s.name}] ${s.description}`);
  const writer = createJsonlWriter(`${logDir}/${s.name}.jsonl`);

  // 1) Harmony: Responses-like params → Harmony-formatted chat messages
  const harmonyMessages = harmonizeResponseParams(s.params, {});
  const preview = harmonyMessages.slice(0, 3).map((m) => ({ role: m.role, content: String(m.content).slice(0, 160) }));
  console.log("🔎 Harmony preview:", preview);

  // 2) Prepare Chat Completions params
  const baseChatParams = extractChatCompletionParams(s.params);
  const messagesForApi = harmonyMessages.map((m) => (m.role === "developer" ? { ...m, role: "system" as const } : m));

  const chatParams: ChatCompletionCreateParams = {
    ...baseChatParams,
    messages: messagesForApi,
    model: s.params.model ?? GROQ_TEST_MODEL,
    stream: false,
  };
  if (s.params.tools && s.params.tools.length > 0) {
    chatParams.tools = convertToolsForChat(s.params.tools);
    chatParams.tool_choice = convertToolChoiceForChat(s.params.tool_choice ?? "auto");
  }

  await writer.write({
    type: "request",
    name: s.name,
    description: s.description,
    request: { original: s.params, harmonyPreview: preview, chatParams },
  });

  // 3) Call Groq Chat Completions
  const completion: ChatCompletion = await client.chat.completions.create(chatParams);
  await writer.write({ type: "chat_completion_response", data: completion });
  console.log(`✅ [${s.name}] model=${completion.model} usage=${completion.usage?.total_tokens ?? 0}`);

  // 4) Build HarmonyMessage from assistant output (no fabrication)
  const choice = completion.choices?.[0];
  const msg = choice?.message;
  const contentStr: string = typeof msg?.content === "string" ? msg.content : String(msg?.content ?? "");
  const toolCalls = (Array.isArray(msg?.tool_calls) ? msg.tool_calls : []) as ChatCompletionMessageToolCall[];

  const tool_calls_harmony: HarmonyMessage["tool_calls"] | undefined =
    toolCalls.length > 0
      ? toolCalls
          .filter((tc) => isFunctionToolCall(tc))
          .map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          }))
      : undefined;

  const harmonyResponse: HarmonyMessage = {
    role: "assistant",
    content: contentStr,
    tool_calls: tool_calls_harmony,
  };
  await writer.write({ type: "harmony_response_input", data: harmonyResponse });

  // 5) Convert Harmony → Responses events
  const events = await convertHarmonyToResponses(harmonyResponse, {
    requestId: `${s.name}_${Date.now()}`,
    model: completion.model,
    stream: false,
  });
  await writer.write({ type: "responses_events", data: events });

  console.log(`🧩 [${s.name}] events=${events.length}`);
  await writer.close();
}

async function main() {
  console.log("🚀 ResponsesEmu Harmony test: Groq + gpt-oss:120b");
  console.log(`🔗 baseURL=${GROQ_BASE_URL}`);
  console.log(`🤖 model=${GROQ_TEST_MODEL}`);
  const logDir = createLogDirectory("responsesemu-harmony");
  console.log(`🗂️ logs: ${logDir}`);

  const scenarios: Scenario[] = [
    {
      name: "basic",
      description: "Simple math with default reasoning",
      params: { model: GROQ_TEST_MODEL, input: "What is 12 * 7?" },
    },
    {
      name: "developer-instructions",
      description: "Developer instructions included",
      params: {
        model: GROQ_TEST_MODEL,
        instructions: "Answer concisely.",
        input: "Summarize Harmony benefits in one line.",
      },
    },
    {
      name: "tooling-auto",
      description: "Auto tool choice with a single function",
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

  for (const s of scenarios) {
    try {
      await runScenario(s, logDir);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`❌ [${s.name}]`, err);
    }
  }

  console.log("\n✨ Done.");
}

if (import.meta.main) {
  // Run via: bun debug/harmony/responsesemu/groq-gpt-oss-120b.ts
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
