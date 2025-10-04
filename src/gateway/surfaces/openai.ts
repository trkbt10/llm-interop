/**
 * @file Gateway surface exposing OpenAI-compatible endpoints.
 */
import { emulateOpenAIEndpoint } from "../../ports/fetch/openai";
import { createGatewayForwarder } from "../core/router-base";
import type { GatewayConfig } from "../core/types";
import { withCors } from "../middleware/cors";
import { createRootHandler, OPENAI_ROUTES } from "../middleware/root-handler";

async function resolveModelFromOpenAIRequest(request: Request, pathname: string) {
  if (request.method.toUpperCase() !== "POST") {
    return { attempted: false };
  }

  if (pathname !== "/v1/responses" && pathname !== "/v1/chat/completions") {
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
 * Creates a fetch proxy that routes OpenAI-compatible requests across configured backends.
 */
export function createOpenAIGateway(config: GatewayConfig) {
  const forward = createGatewayForwarder(config, {
    fetchFactory: (backend) => emulateOpenAIEndpoint({ provider: backend.provider }),
    resolveModel: resolveModelFromOpenAIRequest,
  });

  const handleRoot = createRootHandler(
    "OpenAI Gateway",
    OPENAI_ROUTES,
    "https://platform.openai.com/docs/api-reference",
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
