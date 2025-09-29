/**
 * @file Gateway surface exposing Gemini-compatible endpoints.
 */
import { Hono } from "hono";

import { emulateGeminiEndpoint } from "../../ports/fetch/gemini";
import { createGatewayForwarder } from "../core/router-base";
import type { GatewayConfig } from "../core/types";

const MODEL_PATH_REGEX =
  /^\/v1(?:beta)?\/models\/(.+?):(generateContent|streamGenerateContent|countTokens|embedContent|batchEmbedContents)$/;

async function resolveModelFromGeminiRequest(request: Request, pathname: string) {
  const match = pathname.match(MODEL_PATH_REGEX);
  if (!match) {
    return { attempted: false };
  }

  const encoded = match[1];
  const model = encoded ? decodeURIComponent(encoded) : undefined;
  return { attempted: true, model };
}

/**
 * Creates a Hono application that proxies Gemini-compatible requests across configured backends.
 */
export function createGeminiGateway(config: GatewayConfig): Hono {
  const app = new Hono();
  const forward = createGatewayForwarder(config, {
    fetchFactory: (backend) => emulateGeminiEndpoint({ provider: backend.provider }),
    resolveModel: resolveModelFromGeminiRequest,
  });

  app.all("*", (context) => forward(context.req.raw));

  return app;
}
