/**
 * @file Gateway configuration factory helpers.
 */
import type { GatewayConfig, GatewayConfigInput, GatewayBackendConfig } from "../core/types";

/**
 * Normalizes gateway configuration input into the internal structure used by the balancer.
 */
export function createGatewayConfig(input: GatewayConfigInput): GatewayConfig {
  if (!input || !Array.isArray(input.backends) || input.backends.length === 0) {
    throw new Error("Gateway config requires at least one backend definition");
  }

  const backendRecord: Record<string, GatewayBackendConfig> = Object.create(null);

  for (const backend of input.backends) {
    if (!backend?.id) {
      throw new Error("Gateway backend definition must include an id");
    }

    const key = backend.id.toLowerCase();

    if (backendRecord[key]) {
      throw new Error(`Duplicate gateway backend id detected: ${backend.id}`);
    }

    backendRecord[key] = { ...backend, id: key } satisfies GatewayBackendConfig;
  }

  return {
    ...input,
    backendRecord,
  } satisfies GatewayConfig;
}
