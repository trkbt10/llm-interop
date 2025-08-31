/**
 * @file Emulation helpers for a subset of Google Gemini HTTP endpoints used in tests/samples.
 *
 * Exports a pure route handler `handleGeminiRoute` so callers/tests can simulate requests
 * without wiring a fetch proxy. `emulateGeminiEndpoint` remains a thin wrapper.
 */
import type { Provider } from "../../config/types";
import { buildOpenAICompatibleClientForGemini } from "../../adapters/gemini-to-openai/openai-compatible";
import type { OpenAICompatibleClient } from "../../adapters/openai-client-types";
import { createSSEResponse } from "./utils/sse-builder";
import { errorResponse, jsonResponse, createFetchHandler } from "./utils/http";
import { bodyToText } from "./utils/body";

// Programmatic adapter that simulates v1beta endpoints
import { buildOpenAItoGeminiV1BetaAdapter } from "../../adapters/openai-to-gemini-v1beta";
import type { GenerateContentFn, ListModelsFn, StreamGenerateContentFn } from "../../adapters/openai-to-gemini-v1beta/core/adapter-types";
import { GeminiFetchClient, type BatchEmbedContentsRequest, type BatchEmbedContentsResponse, type CountTokensRequest, type CountTokensResponse, type EmbedContentRequest, type EmbedContentResponse } from "../../providers/gemini/client/fetch-client";
import { selectApiKey } from "../../config/select-api-key";

export type RouteHandler = (pathname: string, init?: RequestInit) => Promise<Response>;

export type GeminiEndpointAdapter = {
  generateContent: GenerateContentFn;
  streamGenerateContent: StreamGenerateContentFn;
  listModels: ListModelsFn;
  countTokens?: (model: string, body: CountTokensRequest) => Promise<CountTokensResponse>;
  embedContent?: (model: string, body: EmbedContentRequest) => Promise<EmbedContentResponse>;
  batchEmbedContents?: (model: string, body: BatchEmbedContentsRequest) => Promise<BatchEmbedContentsResponse>;
  listTunedModels?: () => Promise<{ tunedModels: Array<{ name: string; displayName?: string; description?: string }> }>;
  getTunedModel?: (name: string) => Promise<{ name: string; displayName?: string; description?: string }>;
};

/** JSONL chunked response builder (non‑SSE streaming) */
function jsonlResponse(stream: AsyncIterable<unknown>): Response {
  const rs = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of stream) {
          const line = JSON.stringify(chunk) + "\n";
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new Response(rs, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "transfer-encoding": "chunked",
    },
  });
}

/** Build adapter bound to a Gemini provider */
export function buildGeminiEmulatorAdapter(provider: Provider): GeminiEndpointAdapter {
  const client: OpenAICompatibleClient = buildOpenAICompatibleClientForGemini(provider);
  const base = buildOpenAItoGeminiV1BetaAdapter({ client });
  const apiKey = selectApiKey(provider);
  const fetchClient = new GeminiFetchClient({ apiKey: apiKey!, baseURL: provider.baseURL });
  return {
    ...base,
    async countTokens(model, body) { return fetchClient.countTokens(model, body); },
    async embedContent(model, body) { return fetchClient.embedContent(model, body); },
    async batchEmbedContents(model, body) { return fetchClient.batchEmbedContents(model, body); },
    async listTunedModels() { return { tunedModels: [] }; },
    async getTunedModel(name: string) { return { name }; },
  };
}

/**
 * Pure handler for Gemini-like routes. Useful for simulation/tests.
 * Pass a pre-built adapter (generate/stream/list) to route a request.
 */
export async function handleGeminiRoute(
  url: URL,
  init: RequestInit | undefined,
  adapter: GeminiEndpointAdapter,
): Promise<Response> {
  const p = url.pathname;

  const match = p.match(/^\/v1(?:beta)?\/models\/(.+?):(generateContent|streamGenerateContent)$/);
  if (match) {
    const [, modelId, action] = match;
    const isStream = action === "streamGenerateContent";

    if (!init?.method || init.method.toUpperCase() !== "POST") {
      return errorResponse(405, `Only POST is supported for ${action}`, "method_not_allowed");
    }
    if (!init.body) {
      return errorResponse(400, "Missing request body");
    }

    try {
      const raw = await bodyToText(init.body);
      const geminiReq = JSON.parse(String(raw));

      if (isStream) {
        const stream = await adapter.streamGenerateContent(modelId, geminiReq);
        const altParam = url.searchParams.get("alt");
        const alt = altParam ? altParam.toLowerCase() : "";
        // alt=sse → SSE, otherwise JSONL chunked transport
        if (alt === "sse") {
          return createSSEResponse(stream, "gemini");
        }
        return jsonlResponse(stream);
      }
      const obj = await adapter.generateContent(modelId, geminiReq);
      return jsonResponse(obj);
    } catch (error) {
      return errorResponse(400, `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Token counting
  const mCount = p.match(/^\/v1(?:beta)?\/models\/(.+?):countTokens$/);
  if (mCount) {
    if (!init?.method || init.method.toUpperCase() !== "POST") {
      return errorResponse(405, "Only POST is supported for countTokens", "method_not_allowed");
    }
    if (!init.body) {
      return errorResponse(400, "Missing request body");
    }
    try {
      const raw = await bodyToText(init.body);
      const body = JSON.parse(String(raw)) as CountTokensRequest;
      if (!adapter.countTokens) {
        return errorResponse(501, "countTokens not implemented in adapter", "not_implemented");
      }
      const json = await adapter.countTokens(mCount[1]!, body);
      return jsonResponse(json);
    } catch (error) {
      return errorResponse(400, `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Embeddings
  const mEmbed = p.match(/^\/v1(?:beta)?\/models\/(.+?):embedContent$/);
  if (mEmbed) {
    if (!init?.method || init.method.toUpperCase() !== "POST") {
      return errorResponse(405, "Only POST is supported for embedContent", "method_not_allowed");
    }
    if (!init.body) {
      return errorResponse(400, "Missing request body");
    }
    try {
      const raw = await bodyToText(init.body);
      const body = JSON.parse(String(raw)) as EmbedContentRequest;
      if (!adapter.embedContent) {
        return errorResponse(501, "embedContent not implemented in adapter", "not_implemented");
      }
      const json = await adapter.embedContent(mEmbed[1]!, body);
      return jsonResponse(json);
    } catch (error) {
      return errorResponse(400, `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const mBatch = p.match(/^\/v1(?:beta)?\/models\/(.+?):batchEmbedContents$/);
  if (mBatch) {
    if (!init?.method || init.method.toUpperCase() !== "POST") {
      return errorResponse(405, "Only POST is supported for batchEmbedContents", "method_not_allowed");
    }
    if (!init.body) {
      return errorResponse(400, "Missing request body");
    }
    try {
      const raw = await bodyToText(init.body);
      const body = JSON.parse(String(raw)) as BatchEmbedContentsRequest;
      if (!adapter.batchEmbedContents) {
        return errorResponse(501, "batchEmbedContents not implemented in adapter", "not_implemented");
      }
      const json = await adapter.batchEmbedContents(mBatch[1]!, body);
      return jsonResponse(json);
    } catch (error) {
      return errorResponse(400, `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Tuned models list
  if (p === "/v1beta/tunedModels" || p === "/v1/tunedModels") {
    if (!adapter.listTunedModels) {
      return errorResponse(501, "tunedModels listing not implemented", "not_implemented");
    }
    const json = await adapter.listTunedModels();
    return jsonResponse(json);
  }

  // Tuned model get
  const tuned = p.match(/^\/v1(?:beta)?\/tunedModels\/(.+)$/);
  if (tuned && (!init?.method || init.method.toUpperCase() === "GET")) {
    if (!adapter.getTunedModel) {
      return errorResponse(501, "get tunedModel not implemented", "not_implemented");
    }
    const name = decodeURIComponent(tuned[1]!);
    const obj = await adapter.getTunedModel(name);
    if (!obj) {
      return errorResponse(404, `Tuned model not found: ${name}`, "not_found");
    }
    return jsonResponse(obj);
  }

  if (p === "/v1/models" || p === "/v1beta/models") {
    try {
      const models = await adapter.listModels();
      return jsonResponse(models);
    } catch (error) {
      throw new Error(
        `Failed to fetch models from Gemini provider: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // GET /v1(beta)/models/{model}
  const getModel = p.match(/^\/v1(?:beta)?\/models\/(.+)$/);
  if (getModel && (!init?.method || init.method.toUpperCase() === "GET")) {
    try {
      const name = decodeURIComponent(getModel[1]!);
      const { models } = await adapter.listModels();
      const full = name.startsWith("models/") ? name : `models/${name}`;
      const m = models.find((x) => x.name === full || x.displayName === name);
      if (!m) {
        return errorResponse(404, `Model not found: ${name}`, "not_found");
      }
      return jsonResponse(m);
    } catch (error) {
      return errorResponse(500, `Failed to resolve model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return errorResponse(404, `Unhandled path: ${url.pathname}`, "not_found");
}

/**
 * Emulate Google Gemini endpoints using OpenAI-compatible backend:
 *  - POST /v1/models/{model}:generateContent -> Responses API (primary) with Chat fallback
 *  - POST /v1/models/{model}:streamGenerateContent -> Streaming version
 *  - Same under /v1beta
 *  - GET  /v1/models, /v1beta/models to list
 */
export function emulateGeminiEndpoint(options: { provider: Provider }) {
  const { provider } = options;
  const adapter = buildGeminiEmulatorAdapter(provider);

  return createFetchHandler(async (url: URL, init?: RequestInit): Promise<Response> => {
    return handleGeminiRoute(url, init, adapter);
  });
}
