/**
 * @file Emulation helpers for a subset of OpenAI Responses-compatible HTTP endpoints.
 */
import type { Provider } from "../../config/types";
import { buildOpenAICompatibleClient } from "../../adapters/openai-client";
import type { OpenAICompatibleClient } from "../../adapters/openai-client-types";
import { createSSEResponse, isAsyncIterable } from "./utils/sse-builder";
import { errorResponse, jsonResponse, createFetchHandler } from "./utils/http";
import { bodyToText } from "./utils/body";

// Import types
import type {
  Response as OpenAIResponse,
  ResponseCreateParams,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "openai/resources/chat/completions";

/**
 * Emulate OpenAI endpoint surface using OpenAI-compatible backend:
 *  - POST /v1/responses -> primary endpoint
 *  - POST /v1/chat/completions -> fallback/compatibility endpoint
 *  - GET  /v1/models -> models from backend
 *  - GET  /api/tags   -> Ollama-like tags for debug parity
 */
export function emulateOpenAIEndpoint(options: { provider: Provider }) {
  const { provider } = options;
  const client: OpenAICompatibleClient = buildOpenAICompatibleClient(provider);

  return createFetchHandler(async (url: URL, init?: RequestInit): Promise<Response> => {
    // Responses API - Primary endpoint
    if (url.pathname === "/v1/responses") {
      if (!init?.method || init.method.toUpperCase() !== "POST") {
        return errorResponse(405, "Only POST is supported for /v1/responses", "method_not_allowed");
      }
      if (!init?.body) {
        return errorResponse(400, "Missing request body");
      }

      try {
        const raw = await bodyToText(init.body);
        const responsesReq = JSON.parse(String(raw)) as ResponseCreateParams;

        const result = await client.responses.create(responsesReq);

        if (responsesReq.stream || isAsyncIterable(result)) {
          return createSSEResponse(result as AsyncIterable<ResponseStreamEvent>);
        }

        return jsonResponse(result as OpenAIResponse);
      } catch (error) {
        return errorResponse(
          400,
          `Invalid JSON body or request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Chat Completions API - Compatibility endpoint
    if (url.pathname === "/v1/chat/completions") {
      if (!init?.method || init.method.toUpperCase() !== "POST") {
        return errorResponse(405, "Only POST is supported for /v1/chat/completions", "method_not_allowed");
      }
      if (!init?.body) {
        return errorResponse(400, "Missing request body");
      }

      try {
        const raw = await bodyToText(init.body);
        const chatReq = JSON.parse(String(raw)) as ChatCompletionCreateParams;

        const result = await client.chat.completions.create(chatReq);

        if (chatReq.stream || isAsyncIterable(result)) {
          return createSSEResponse(result as AsyncIterable<ChatCompletionChunk>);
        }

        return jsonResponse(result as ChatCompletion);
      } catch (error) {
        return errorResponse(
          400,
          `Invalid JSON body or request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Models API
    if (url.pathname === "/v1/models") {
      try {
        const models = await client.models.list();
        return jsonResponse(models);
      } catch (error) {
        // Fallback with basic model
        throw new Error(
          `Failed to fetch models from OpenAI-compatible provider: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Ollama-style tags endpoint for debugging
    if (url.pathname === "/api/tags") {
      try {
        const models = await client.models.list();
        return jsonResponse({
          models: models.data.map((model: { id: string }) => ({
            name: model.id,
            model: model.id,
            digest: "sha256:debug",
            modified_at: new Date().toISOString(),
            size: 0,
            details: {
              format: "openai",
              family: provider.type ?? "openai",
              families: [provider.type ?? "openai"],
            },
          })),
        });
      } catch (error) {
        throw new Error(
          `Failed to fetch model tags from provider: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return errorResponse(404, `Unhandled path: ${url.pathname}`, "not_found");
  });
}

// Legacy alias for backward compatibility
// export const emulateOpenAIResponsesEndpoint = emulateOpenAIEndpoint; // deprecated: do not re-add
