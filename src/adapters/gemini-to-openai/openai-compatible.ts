/**
 * @file OpenAI-compatible client implementation for Gemini provider
 * Creates an OpenAI-compatible interface for Google Gemini, implementing both Chat Completions
 * and Responses APIs by wrapping Gemini's generateContent API and transforming requests/responses
 * to maintain full compatibility with OpenAI client expectations.
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
import type { GenerateContentRequest } from "../../providers/gemini/client/fetch-client";
import { GeminiFetchClient } from "../../providers/gemini/client/fetch-client";
import { ensureGeminiStream, isGeminiResponse } from "../../providers/gemini/guards";
import type { OpenAICompatibleClient } from "../openai-client-types";
import { defineChatCompletionsCreate, defineResponsesCreate } from "../openai-client-types";
import { selectApiKey } from "../../config/select-api-key";
import { responsesToGeminiRequest } from "../openai-to-gemini-v1beta/request-converter";
import { resolveModelForProvider } from "../../model/mapper";
import { geminiToChatCompletion, geminiToChatCompletionStream } from "./chat-completion/openai-chat-adapter";
import { geminiToOpenAIResponse } from "./chat-completion/openai-response-adapter";
import { geminiToOpenAIStream } from "./chat-completion/openai-stream-adapter";

// Narrowing helpers
function isChatStreaming(p: ChatCompletionCreateParams): boolean {
  return !!(p as { stream?: boolean }).stream;
}
function isResponseStreaming(p: ResponseCreateParams): boolean {
  if (!("stream" in p)) {
    return false;
  }
  return (p as { stream?: boolean }).stream === true;
}

/**
 * Creates a complete OpenAI-compatible client interface that wraps Google Gemini API functionality.
 * Provides full OpenAI API compatibility by implementing Chat Completions and Response APIs
 * on top of Gemini's generateContent endpoint. Essential for enabling drop-in replacement
 * of OpenAI clients with Gemini backend while maintaining complete API compatibility.
 *
 * @param provider - Gemini provider configuration with API credentials and settings
 * @param modelHint - Optional model identifier for optimizing client initialization
 * @returns Complete OpenAI-compatible client with Chat Completions, Responses, and Models APIs
 */
export function buildOpenAICompatibleClientForGemini(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  const apiKey = selectApiKey(provider);
  if (!apiKey) {
    throw new Error("Gemini provider requires an apiKey");
  }
  const client = new GeminiFetchClient({ apiKey, baseURL: provider.baseURL });
  // eslint-disable-next-line no-restricted-syntax -- State maintained across function calls for performance
  let resolveToolName: ((callId: string) => string | undefined) | undefined;

  const chatCompletionsCreate = defineChatCompletionsCreate(
    async (params: ChatCompletionCreateParams): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> => {
      const model = await resolveModelForProvider({
        provider,
        sourceModel: params.model ? params.model : modelHint,
        modelHint,
      });
      if (isChatStreaming(params)) {
        return geminiToChatCompletionStream({ ...params, model });
      }
      return geminiToChatCompletion({ ...params, model });
    },
  );

  const responsesCreate = defineResponsesCreate(
    async (
      params: ResponseCreateParams,
      options?: { signal?: AbortSignal },
    ): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>> => {
      const model = await resolveModelForProvider({
        provider,
        sourceModel: (params as { model?: string }).model ? (params as { model?: string }).model : modelHint,
        modelHint,
      });
      const body = responsesToGeminiRequest(params, resolveToolName);
      if (isResponseStreaming(params)) {
        const stream = client.streamGenerateContent(model, body as GenerateContentRequest, options?.signal);
        return geminiToOpenAIStream(
          ensureGeminiStream(stream as AsyncIterable<unknown>),
        ) as AsyncIterable<ResponseStreamEvent>;
      }
      const raw = await client.generateContent(model, body as GenerateContentRequest, options?.signal);
      if (!isGeminiResponse(raw)) {
        throw new Error("Unexpected Gemini response shape");
      }
      return geminiToOpenAIResponse(raw, model) as OpenAIResponse;
    },
  );

  return {
    chat: { completions: { create: chatCompletionsCreate } },
    responses: { create: responsesCreate },
    models: {
      async list() {
        const res = await client.listModels();
        return {
          data: res.models.map((m) => ({
            id: m.name,
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "google",
          })),
        };
      },
    },
    setToolNameResolver(resolver: (callId: string) => string | undefined) {
      resolveToolName = resolver;
    },
  };
}
