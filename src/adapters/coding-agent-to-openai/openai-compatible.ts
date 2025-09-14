/**
 * @file OpenAI-compatible client implementation for local coding agents (Claude Code CLI backend)
 * Wraps a CLI-based coding agent and exposes OpenAI-compatible Chat Completions and Responses APIs.
 */
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "openai/resources/chat/completions";
import type {
  Response as OpenAIResponse,
  ResponseCreateParams,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type { Provider } from "../../config/types";
import type { OpenAICompatibleClient } from "../openai-client-types";
import { defineChatCompletionsCreate, defineResponsesCreate } from "../openai-client-types";
import { resolveModelForProvider } from "../../model/mapper";
import { formatMessagesForClaudeCode, toClaudeCodeMessages } from "./core/message";
import { streamTextToChatChunks } from "./markdown/stream";
import { createSession } from "./io/session";
import { tailFile } from "./io/tail";
import type { CodingAgentDriver } from "./drivers/types";
import { createClaudeCodeDriver } from "./drivers/claude-code";
import { createCodexDriver } from "./drivers/codex-cli";
import { createGeminiCLIDriver } from "./drivers/gemini-cli";
import { readFileSync, writeFileSync } from "node:fs";
import type { ChatCompletionMessageParam, ChatCompletionCreateParamsStreaming, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { convertResponseInputToMessages } from "../openai-compatible/responses-emulator/responses-adapter/input-converter";
import { convertChatCompletionToResponse } from "../openai-compatible/responses-emulator/responses-adapter/chat-to-response-converter";
import { createStreamHandlerState, handleStream } from "../openai-compatible/responses-emulator/responses-adapter/stream-handler";

// helpers moved to message-format.ts

// Removed: parsing handled by drivers

// streaming helper moved to stream-builder.ts

/**
 * Build an OpenAI-compatible client that proxies to a local coding-agent CLI (Claude Code).
 * No environment variables are read; configuration must be provided via Provider.codingAgent.
 */
export function buildOpenAICompatibleClientForCodingAgent(
  provider: Provider,
  modelHint?: string,
): OpenAICompatibleClient {
  const chatCompletionsCreate = defineChatCompletionsCreate(
    async (params: ChatCompletionCreateParams): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> => {
      const model = await resolveModelForProvider({ provider, sourceModel: params.model, modelHint });
      const messages = params.messages ?? [];
      const plainMessages = toClaudeCodeMessages(messages as ChatCompletionMessageParam[]);
      const prompt = formatMessagesForClaudeCode(plainMessages);

      const driver = selectDriver(provider);
      const session = createSession();
      await driver.start(prompt, session.paths);

      if (params.stream) {
        // True incremental streaming from file tail
        return streamTextToChatChunks(model, tailFile(session.paths.outputPath, { idleMs: 400 }));
      }
      const output = safeRead(session.paths.outputPath);
      if (provider.codingAgent?.produces === "json" && driver.parseResult) {
        const parsed = driver.parseResult(safeRead(session.paths.resultPath));
        const text = parsed?.text ?? output;
        return finalizeTextCompletion(model, text);
      }
      return finalizeTextCompletion(model, output);
    },
  );

  const responsesCreate = defineResponsesCreate(
    async (
      params: ResponseCreateParams,
    ): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>> => {
      // Map Responses params to ChatCompletionCreateParams
      const messages: ChatCompletionMessageParam[] = [];
      if (params.instructions) {
        messages.push({ role: "system", content: params.instructions });
      }
      if (params.input) {
        if (typeof params.input === "string") {
          messages.push({ role: "user", content: params.input });
        } else {
          messages.push(...convertResponseInputToMessages(params.input));
        }
      }
      const chatParams: ChatCompletionCreateParams = {
        model: params.model ?? modelHint ?? "",
        messages,
        stream: !!params.stream,
      };

      if (chatParams.stream) {
        const streamParams: ChatCompletionCreateParamsStreaming = {
          ...chatParams,
          stream: true,
        };
        const stream = await chatCompletionsCreate(streamParams);
        // Convert ChatCompletion stream to Responses stream
        const state = createStreamHandlerState();
        return handleStream(state, stream);
      }

      const nonStreamParams: ChatCompletionCreateParamsNonStreaming = {
        ...chatParams,
        stream: false,
      };
      const completion = await chatCompletionsCreate(nonStreamParams);
      return convertChatCompletionToResponse(completion);
    },
  );

  return {
    chat: { completions: { create: chatCompletionsCreate } },
    responses: { create: responsesCreate },
    models: {
      async list() {
        // CLI backend: we cannot list models; return a stub with the configured/default model
        const id = await resolveModelForProvider({ provider, sourceModel: provider.model, modelHint });
        return {
          data: [
            {
              id,
              object: "model",
              created: Math.floor(Date.now() / 1000),
              owned_by: "local-coding-agent",
            },
          ],
        };
      },
    },
  };
}

function finalizeTextCompletion(model: string, text: string): ChatCompletion {
  return {
    id: `chatcmpl_${Math.random().toString(36).slice(2)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text, refusal: null }, finish_reason: "stop", logprobs: null }],
    usage: undefined,
  } as ChatCompletion;
}

function selectDriver(provider: Provider): CodingAgentDriver {
  const kind = ((provider.codingAgent as { kind?: string } | undefined)?.kind) ?? "claude-code";
  if (kind === "claude-code") {
    const binPath = provider.codingAgent?.binPath;
    if (!binPath) {
      throw new Error("Provider.codingAgent.binPath is required for coding-agent backend");
    }
    return createClaudeCodeDriver(
      binPath,
      provider.codingAgent?.args,
      provider.codingAgent?.produces === "jsonl" ? "json" : provider.codingAgent?.produces,
    );
  }
  if (kind === "codex-cli") {
    const binPath = provider.codingAgent?.binPath;
    if (!binPath) {
      throw new Error("Provider.codingAgent.binPath is required for coding-agent backend");
    }
    return createCodexDriver(binPath, provider.codingAgent?.args);
  }
  if (kind === "gemini-cli") {
    const binPath = provider.codingAgent?.binPath;
    if (!binPath) {
      throw new Error("Provider.codingAgent.binPath is required for coding-agent backend");
    }
    return createGeminiCLIDriver(binPath, provider.codingAgent?.args);
  }
  if (kind === "test-stub") {
    return {
      async start(prompt, session) {
        const out = `Echo: ${prompt}`;
        writeFileSync(session.outputPath, out);
        if (provider.codingAgent?.produces === "json") {
          const json = JSON.stringify({ type: "result", result: out });
          writeFileSync(session.resultPath ?? "", json);
        }
        return {};
      },
      parseResult(stdout) {
        try {
          const parsed = JSON.parse(stdout) as { result?: string };
          return { text: String(parsed.result ?? "") };
        } catch {
          return { text: stdout };
        }
      },
    } as CodingAgentDriver;
  }
  throw new Error(`Unsupported coding agent kind: ${kind}`);
}

function safeRead(path?: string): string {
  if (!path) {
    return "";
  }
  try {
    return readFileSync(path, { encoding: "utf8" as BufferEncoding });
  } catch {
    return "";
  }
}
