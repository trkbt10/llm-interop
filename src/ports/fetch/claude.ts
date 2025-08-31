/**
 * @file Emulation helpers for a subset of Anthropic Claude HTTP endpoints.
 */
import type { Provider } from "../../config/types";
import { buildOpenAICompatibleClient } from "../../adapters/openai-client";
import type { OpenAICompatibleClient } from "../../adapters/openai-client-types";
import { bodyToText } from "./utils/body";
import { createFetchHandler, errorResponse, jsonResponse } from "./utils/http";
import { createSSEResponse, isAsyncIterable } from "./utils/sse-builder";

// Import adapters for conversion
import type { Response as OpenAIResponse, ResponseStreamEvent } from "openai/resources/responses/responses";
import { claudeToResponsesLocal } from "../../adapters/claude-to-openai/responses-api/request-to-responses";
import { openAINonStreamToClaudeMessage, openAIToClaudeStream } from "../../adapters/openai-to-claude";
import { resolveModelForProvider } from "../../model/mapper";

export type RouteHandler = (pathname: string, init?: RequestInit) => Promise<Response>;

const parseBody = async (init: RequestInit) => {
  try {
    const raw = await bodyToText(init.body);
    return JSON.parse(String(raw));
  } catch (error) {
    return errorResponse(400, `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Emulate Anthropic Claude endpoint surface using OpenAI-compatible backend:
 *  - POST /v1/messages -> Responses API (primary) with Chat Completions fallback
 *  - POST /v1/messages/count_tokens -> optional handler
 *  - GET  /v1/models  -> models from backend
 */
export function emulateClaudeEndpoint(options: { provider: Provider; handleCountTokens?: RouteHandler }) {
  const { provider, handleCountTokens } = options;
  const client: OpenAICompatibleClient = buildOpenAICompatibleClient(provider, provider.model);

  return createFetchHandler(async (url: URL, init?: RequestInit): Promise<Response> => {
    if (url.pathname === "/v1/messages") {
      if (!init?.method || init.method.toUpperCase() !== "POST") {
        return errorResponse(405, "Only POST is supported for /v1/messages", "method_not_allowed");
      }
      if (!init.body) {
        return errorResponse(400, "Missing request body");
      }

      try {
        const claudeReq = await parseBody(init);
        const model = await resolveModelForProvider({ provider, sourceModel: claudeReq.model });
        // Use Responses API directly without fallback
        const responsesParams = claudeToResponsesLocal(claudeReq, model);
        console.log(responsesParams);
        const result = await client.responses.create(responsesParams);

        if (claudeReq.stream || isAsyncIterable(result)) {
          const stream = openAIToClaudeStream(result as AsyncIterable<ResponseStreamEvent>, `msg_${Date.now()}`);
          return createSSEResponse(stream);
        }

        const claudeMessage = openAINonStreamToClaudeMessage(result as OpenAIResponse, `msg_${Date.now()}`, model);
        return jsonResponse(claudeMessage);
      } catch (error) {
        return errorResponse(
          500,
          `Request processing failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (url.pathname === "/v1/messages/count_tokens") {
      if (!handleCountTokens) {
        return errorResponse(404, "count_tokens not implemented", "not_found");
      }
      if (!init?.method || init.method.toUpperCase() !== "POST") {
        return errorResponse(405, "Only POST is supported for /v1/messages/count_tokens", "method_not_allowed");
      }
      if (!init.body) {
        return errorResponse(400, "Missing request body");
      }
      return handleCountTokens(url.pathname, init);
    }

    if (url.pathname === "/v1/models") {
      try {
        const models = await client.models.list();
        return jsonResponse(models);
      } catch (error) {
        throw new Error(
          `Failed to fetch models from Claude provider: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return errorResponse(404, `Unhandled path: ${url.pathname}`, "not_found");
  });
}
