/**
 * @file Gateway surface exposing Gemini-compatible endpoints.
 */
import { emulateGeminiEndpoint } from "../../ports/fetch/gemini";
import { createGatewayForwarder } from "../core/router-base";
import type { GatewayConfig } from "../core/types";
import { withCors } from "../middleware/cors";
import { createRootHandler, GEMINI_ROUTES } from "../middleware/root-handler";

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

  const handleRoot = createRootHandler(
    "Gemini Gateway",
    GEMINI_ROUTES,
    "https://ai.google.dev/gemini-api/docs/api-overview",
  );

  const fetchHandler = withCors(async (request: Request) => {
    // Handle root endpoint
    const rootResponse = handleRoot(request);
    if (rootResponse) {
      return rootResponse;
    }

    // Forward to backend
    return forward(request);
  }, config.server?.cors);

  return {
    fetch(request: Request) {
      return fetchHandler(request);
    },
  };
}
