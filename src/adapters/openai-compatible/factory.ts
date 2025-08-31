/**
 * @file Factory for creating OpenAI-compatible API clients
 *
 * Why: Provides a unified factory function that creates clients compatible with
 * both Chat Completions and Responses APIs, handling fallback logic and model-specific
 * parameter filtering.
 */

import OpenAI from "openai";
import type { Provider } from "../../config/types";
import type {
  OpenAICompatibleClient,
  ChatCompletionsCreateFn,
  ResponsesCreateFn,
  ResponsesStreamFn,
} from "../openai-client-types";
import { defineChatCompletionsCreate, defineResponsesCreate } from "../openai-client-types";
import type {
  Response as OpenAIResponse,
  ResponseCreateParams,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type { ChatCompletionCreateParams, ChatCompletionChunk } from "openai/resources/chat/completions";
import { selectApiKey } from "../../config/select-api-key";
import { ResponsesAPI } from "./responses-emulator/responses-adapter/responses-api";
import { isResponseEventStream, isResponseParamsStreaming } from "../../providers/openai/responses-guards";
// (no chat → responses auto conversion for chat endpoint)
import { runComposedAttempts } from "../../utils/composed-attempts";

/**
 * Check if a model is an O1-series model
 */
function isO1Model(model: string): boolean {
  if (model.startsWith("o1")) {
    return true;
  }
  if (model.startsWith("o3")) {
    return true;
  }
  if (model.startsWith("o4")) {
    return true;
  }
  return false;
}

/**
 * Filter chat parameters for model compatibility
 */
function filterChatParams(params: ChatCompletionCreateParams): ChatCompletionCreateParams {
  // Always remove temperature and top_p for all models
  const { temperature: _temperature, top_p: _top_p, ...filteredParams } = params;
  void _temperature;
  void _top_p; // Intentionally unused - filtering them out
  return filteredParams;
}

/**
 * Filter response parameters for model compatibility
 */
function filterResponseParams(params: ResponseCreateParams): ResponseCreateParams {
  // Always remove temperature and top_p for all models
  const { temperature: _temperature, top_p: _top_p, ...filteredParams } = params;
  void _temperature;
  void _top_p; // Intentionally unused - filtering them out
  return filteredParams;
}

/**
 * Build an OpenAI-compatible client with fallback logic between APIs
 */
export function buildOpenAIGenericAdapter(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  const baseURL = provider.baseURL && provider.baseURL.trim().length > 0 ? provider.baseURL : undefined;

  if (!baseURL) {
    throw new Error(`Missing baseURL for provider '${provider.type}'. Set provider.baseURL in configuration.`);
  }

  // Keys: prefer configured; if missing and local base, use a dummy key
  const apiKey = selectApiKey(provider, modelHint); // allow 401 from upstream if required

  const client = new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: provider.defaultHeaders,
  });
  // Resolve OpenAI-compat meta options with sensible defaults
  const compat = provider.openaiCompat ?? {};
  const preferResponsesFirst = compat.preferResponsesAPI !== false; // default true
  const emulateResponses = compat.emulateResponsesWithChat === true; // default false unless explicitly enabled
  const autoFallback = compat.autoFallbackToEmulator === true; // default false unless explicitly enabled
  const useHarmony = compat.transformHarmony === true; // default false

  const shim = new ResponsesAPI(client, { useHarmony });

  // Helper: run composed attempts with explicit fallback control
  async function runResponsesComposed(
    baseParams: ResponseCreateParams,
    options?: { signal?: AbortSignal },
    enforceStream?: boolean,
  ): Promise<unknown> {
    // Narrow streaming intent without unsafe casting and without ternaries
    function computeStreaming(enforce: boolean | undefined, base: ResponseCreateParams): boolean {
      if (enforce === true) {
        return true;
      }
      return isResponseParamsStreaming(base);
    }
    const streaming = computeStreaming(enforceStream, baseParams);

    // Prepare params for each mode
    const paramsStreaming: ResponseCreateParamsStreaming = {
      ...baseParams,
      stream: true,
    } as ResponseCreateParamsStreaming;
    const paramsNonStreaming: ResponseCreateParamsNonStreaming = {
      ...baseParams,
      stream: false,
    } as ResponseCreateParamsNonStreaming;

    // Define attempt functions
    const nativeAttempt = async () => {
      const filtered = filterResponseParams(streaming ? paramsStreaming : paramsNonStreaming);
      if (streaming) {
        const stream = await client.responses.create(filtered as ResponseCreateParamsStreaming, options);
        if (!isResponseEventStream(stream)) {
          throw new Error("Expected streaming Responses API result, received non-stream");
        }
        return stream;
      }
      return client.responses.create(filtered as ResponseCreateParamsNonStreaming, options);
    };
    const emulatorAttempt = async () => {
      if (streaming) {
        return shim.create(paramsStreaming);
      }
      return shim.create(paramsNonStreaming);
    };

    // Compose attempt order
    const attempts: Array<() => Promise<unknown>> = [];
    if (preferResponsesFirst) {
      attempts.push(nativeAttempt);
      if (emulateResponses) {
        attempts.push(emulatorAttempt);
      }
    } else {
      if (emulateResponses) {
        attempts.push(emulatorAttempt);
      }
      attempts.push(nativeAttempt);
    }

    return runComposedAttempts(attempts, { autoFallback });
  }

  function isAsyncIterableGeneric(obj: unknown): obj is AsyncIterable<unknown> {
    if (obj === null || obj === undefined) {
      return false;
    }
    const it = (obj as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator];
    return typeof it === "function";
  }

  const chatCreate: ChatCompletionsCreateFn = defineChatCompletionsCreate(
    async (params: ChatCompletionCreateParams, options?: { signal?: AbortSignal }) => {
      const filteredParams = isO1Model(params.model) ? filterChatParams(params) : params;
      const result = await client.chat.completions.create(filteredParams, options);
      if ((params as { stream?: boolean }).stream) {
        if (!isAsyncIterableGeneric(result)) {
          throw new Error("Expected chat.completions stream");
        }
        return result as AsyncIterable<ChatCompletionChunk>;
      }
      return result;
    },
  );

  const responsesCreate: ResponsesCreateFn = defineResponsesCreate(
    async (params: ResponseCreateParams, options?: { signal?: AbortSignal }) => {
      const res = await runResponsesComposed(params, options, false);
      if (isResponseEventStream(res)) {
        return res as AsyncIterable<ResponseStreamEvent>;
      }
      return res as OpenAIResponse;
    },
  );

  const responsesStream: ResponsesStreamFn = async (
    params: ResponseCreateParamsStreaming,
    options?: { signal?: AbortSignal },
  ) => {
    const result = await runResponsesComposed(params, options, true);
    if (!isResponseEventStream(result)) {
      throw new Error("responses.stream expected a streaming result");
    }
    return result;
  };

  const openAIClient: OpenAICompatibleClient = {
    chat: { completions: { create: chatCreate } },
    responses: { create: responsesCreate, stream: responsesStream },
    models: {
      async list() {
        const res = await client.models.list();
        return {
          data: res.data.map((m) => ({
            id: m.id,
            object: m.object,
            created: m.created,
            owned_by: m.owned_by,
          })),
        };
      },
    },
  };

  return openAIClient;
}
