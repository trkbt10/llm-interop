/**
 * @file Gateway surface exposing Gemini-compatible endpoints.
 */
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
 * Creates a fetch proxy that routes Gemini-compatible requests across configured backends.
 */
export function createGeminiGateway(config: GatewayConfig) {
  const forward = createGatewayForwarder(config, {
    fetchFactory: (backend) => emulateGeminiEndpoint({ provider: backend.provider }),
    resolveModel: resolveModelFromGeminiRequest,
  });

  return {
    fetch(request: Request) {
      return forward(request);
    },
  };
}
