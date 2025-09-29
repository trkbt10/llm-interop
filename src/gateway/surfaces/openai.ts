/**
 * @file Gateway surface exposing OpenAI-compatible endpoints.
 */
import { Hono } from "hono";

import { emulateOpenAIEndpoint } from "../../ports/fetch/openai";
import { errorResponse } from "../../ports/fetch/utils/http";
import { createGatewayForwarder } from "../core/router-base";
import type { GatewayConfig } from "../core/types";

const SUPPORTED_PATHS = new Set(["/v1/responses", "/v1/chat/completions", "/v1/models", "/api/tags"]);

async function resolveModelFromOpenAIRequest(request: Request, pathname: string) {
  if (request.method.toUpperCase() !== "POST") {
    return { attempted: false };
  }

  if (!SUPPORTED_PATHS.has(pathname)) {
    return { attempted: false };
  }

  try {
    const clone = request.clone();
    const body = await clone.text();
    if (!body) {
      return { attempted: true };
    }
    const parsed = JSON.parse(body) as { model?: unknown };
    const model = typeof parsed.model === "string" ? parsed.model : undefined;
    return { attempted: true, model };
  } catch (error) {
    console.warn("Failed to parse OpenAI-style request body for model routing:", error);
    return { attempted: true };
  }
}

/**
 * Creates a Hono application that proxies OpenAI-compatible requests across configured backends.
 */
export function createOpenAIGateway(config: GatewayConfig): Hono {
  const app = new Hono();
  const forward = createGatewayForwarder(config, {
    fetchFactory: (backend) => emulateOpenAIEndpoint({ provider: backend.provider }),
    resolveModel: resolveModelFromOpenAIRequest,
  });

  app.post("/v1/responses", (context) => forward(context.req.raw));
  app.post("/v1/chat/completions", (context) => forward(context.req.raw));
  app.get("/v1/models", (context) => forward(context.req.raw));
  app.get("/api/tags", (context) => forward(context.req.raw));

  app.all("*", (context) => {
    const pathname = new URL(context.req.url).pathname;
    if (!SUPPORTED_PATHS.has(pathname)) {
      return errorResponse(404, `Unhandled path: ${pathname}`, "not_found");
    }
    return errorResponse(405, `Method ${context.req.method} not allowed`, "method_not_allowed");
  });

  return app;
}
