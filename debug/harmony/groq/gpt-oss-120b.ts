#!/usr/bin/env bun
/**
 * Harmony test runner for Groq + gpt-oss:120b via OpenAI-compatible API
 *
 * - Builds Harmony-formatted ChatCompletion messages from Responses-style params
 * - Sends to Groq's OpenAI-compatible endpoint
 * - Targets `gpt-oss:120b` by default (override via env)
 *
 * Env vars:
 * - GROQ_API_KEY       (required)
 * - GROQ_BASE_URL      (default: https://api.groq.com/openai/v1)
 * - GROQ_TEST_MODEL    (default: gpt-oss:120b)
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
import { createJsonlWriter } from "../../../src/utils/jsonl/writer";
import { createLogDirectory } from "../../fetch/support/log-utils";

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

async function runScenario(s: Scenario, logDir: string): Promise<ChatCompletion> {
  console.log(`\n📤 [${s.name}] ${s.description}`);
  const writer = createJsonlWriter(`${logDir}/${s.name}.jsonl`);

  // Always harmonize Responses-style params to Harmony chat messages
  const harmonyMessages = harmonizeResponseParams(s.params, {});
  // Proof/log of Harmony usage
  const preview = harmonyMessages.slice(0, 3).map((m) => ({ role: m.role, content: String(m.content).slice(0, 160) }));
  console.log("🔎 Harmony preview:", preview);

  // Ensure Chat API compatible roles (developer -> system for transport)
  const messagesForApi = harmonyMessages.map((m) => (m.role === "developer" ? { ...m, role: "system" as const } : m));
  const baseChatParams = extractChatCompletionParams(s.params);

  const chatParams: ChatCompletionCreateParams = {
    ...baseChatParams,
    messages: messagesForApi,
    model: s.params.model ?? GROQ_TEST_MODEL,
    stream: false,
  };

  // If tools are provided, convert and enable auto tool choice by default
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
  const res = await client.chat.completions.create(chatParams);
  console.log(`✅ [${s.name}] model=${res.model} usage=${res.usage?.total_tokens ?? 0}`);
  await writer.write({ type: "response", data: res });

  // Optional: if the assistant only emitted tool_calls, print them and optionally mock-run once
  const choice = res.choices?.[0];
  const msg = choice?.message;
  const hasEmptyContent = !msg?.content || (typeof msg.content === "string" && msg.content.length === 0);
  const toolCalls = (Array.isArray(msg?.tool_calls) ? msg?.tool_calls : []) as ChatCompletionMessageToolCall[];
  if (hasEmptyContent && toolCalls.length > 0) {
    console.log(`🔧 [${s.name}] tool calls:`);
    for (const tc of toolCalls) {
      if (isFunctionToolCall(tc)) {
        console.log(`  - ${tc.function.name}(${tc.function.arguments}) [id=${tc.id}]`);
      }
    }
  }
  await writer.close();
  return res;
}

async function main() {
  console.log("🚀 Harmony test: Groq + gpt-oss:120b (OpenAI-compatible)");
  console.log(`🔗 baseURL=${GROQ_BASE_URL}`);
  console.log(`🤖 model=${GROQ_TEST_MODEL}`);
  const logDir = createLogDirectory("harmony-groq");
  console.log(`🗂️ logs: ${logDir}`);

  // Quick sanity: ensure model seems available
  try {
    const list = await client.models.list();
    const found = list.data.some((m) => m.id === GROQ_TEST_MODEL);
    if (!found) {
      console.warn("⚠️ Model not listed by provider; proceeding anyway.");
    }
  } catch {
    console.warn("⚠️ Could not list models; proceeding.");
  }

  const scenarios: Scenario[] = [
    {
      name: "basic",
      description: "Simple math with default reasoning",
      params: {
        model: GROQ_TEST_MODEL,
        input: "What is 12 * 7?",
      },
    },
    {
      name: "developer-instructions",
      description: "Use developer instructions and response constraints",
      params: {
        model: GROQ_TEST_MODEL,
        instructions: "Answer in exactly two concise bullet points.",
        input: "Summarize key benefits of Harmony format.",
        max_output_tokens: 120,
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
      const res = await runScenario(s, logDir);
      const text = res.choices?.[0]?.message?.content ?? "<no content>";
      console.log(`📝 [${s.name}] ${text}`);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`❌ [${s.name}]`, err);
    }
  }

  console.log("\n✨ Done.");
}

if (import.meta.main) {
  // Run via: bun debug/harmony/groq/gpt-oss-120b.ts
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// Use shared isFunctionToolCall guard from providers/openai/responses-guards
