/**
 * @file Factory for creating native OpenAI API adapters.
 * Wraps the official OpenAI SDK to provide a consistent interface with other providers.
 */

import OpenAI from "openai";
import type { Provider } from "../../config/types";
import type { OpenAICompatibleClient, ChatCompletionsCreateFn, ResponsesCreateFn } from "../openai-client-types";
import { selectApiKey } from "../../config/select-api-key";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import type { ResponseCreateParams } from "openai/resources/responses/responses";

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

function filterChatParams(params: ChatCompletionCreateParams): ChatCompletionCreateParams {
  // Always remove temperature and top_p for all models
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring to exclude temperature and top_p
  const { temperature, top_p, ...filteredParams } = params;
  return filteredParams;
}

function filterResponseParams(params: ResponseCreateParams): ResponseCreateParams {
  // Always remove temperature and top_p for all models
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring to exclude temperature and top_p
  const { temperature, top_p, ...filteredParams } = params;
  return filteredParams;
}

/**
 * Creates a client adapter for the native OpenAI API.
 * Handles parameter filtering for specific models (e.g., o1 series) and provides
 * both chat completions and responses endpoints.
 * @param provider - Provider configuration containing API credentials
 * @param modelHint - Optional model hint for API key selection
 * @returns OpenAI-compatible client interface
 */
export function buildOpenAIPassthroughAdapter(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  const resolvedKey = selectApiKey(provider, modelHint);
  if (!resolvedKey) {
    throw new Error("Missing OpenAI API key");
  }
  const client = new OpenAI({
    apiKey: resolvedKey,
    baseURL: provider.baseURL,
    defaultHeaders: { "OpenAI-Beta": "responses-2025-06-21", ...provider.defaultHeaders },
  });

  const openAIClient: OpenAICompatibleClient = {
    chat: {
      completions: {
        create: (async (params: ChatCompletionCreateParams, options?: { signal?: AbortSignal }) => {
          // Filter parameters for o1 models before calling native API
          const filteredParams = isO1Model(params.model) ? filterChatParams(params) : params;

          // Try native Chat Completions API first
          return await client.chat.completions.create(filteredParams, options);
        }) as ChatCompletionsCreateFn,
      },
    },
    responses: {
      create: (async (params: ResponseCreateParams, options?: { signal?: AbortSignal }) => {
        // Filter parameters for o1 models before calling native API
        const filteredParams = filterResponseParams(params);

        return await client.responses.create(filteredParams, options);
      }) as ResponsesCreateFn,
    },
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
