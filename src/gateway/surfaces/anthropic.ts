/**
 * @file Gateway surface exposing Anthropic-compatible endpoints.
 */
import { emulateClaudeEndpoint } from "../../ports/fetch/claude";
import { createGatewayForwarder } from "../core/router-base";
import type { GatewayConfig } from "../core/types";

async function resolveModelFromAnthropicRequest(request: Request, pathname: string) {
  if (request.method.toUpperCase() !== "POST") {
    return { attempted: false };
  }

  if (pathname !== "/v1/messages" && pathname !== "/v1/messages/count_tokens") {
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
    console.warn("Failed to parse Anthropic-style request body for model routing:", error);
    return { attempted: true };
  }
}

/**
 * Creates a fetch proxy that routes Anthropic-compatible requests across configured backends.
 */
export function createAnthropicGateway(config: GatewayConfig) {
  const forward = createGatewayForwarder(config, {
    fetchFactory: (backend) => emulateClaudeEndpoint({ provider: backend.provider }),
    resolveModel: resolveModelFromAnthropicRequest,
  });

  return {
    fetch(request: Request) {
      return forward(request);
    },
  };
}
