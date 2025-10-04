/**
 * @file Gateway configuration factory helpers.
 */
import type { GatewayConfig, GatewayBackendConfig, GatewayRoutingConfig, GatewaySelectionConfig } from "../core/types";

export type GatewayConfigInput = {
  backends: GatewayBackendConfig[];
  routing?: GatewayRoutingConfig;
  selection?: GatewaySelectionConfig;
};

/**
 * Normalizes gateway configuration input into the internal structure used by the balancer.
 */
export function createGatewayConfig(input: GatewayConfigInput): GatewayConfig {
  if (!input || !Array.isArray(input.backends) || input.backends.length === 0) {
    throw new Error("Gateway config requires at least one backend definition");
  }

  const backends: Record<string, GatewayBackendConfig> = Object.create(null);

  for (const backend of input.backends) {
    if (!backend?.id) {
      throw new Error("Gateway backend definition must include an id");
    }

    const key = backend.id.toLowerCase();

    if (backends[key]) {
      throw new Error(`Duplicate gateway backend id detected: ${backend.id}`);
    }

    backends[key] = { ...backend, id: key } satisfies GatewayBackendConfig;
  }

  return {
    backends,
    routing: input.routing,
    selection: input.selection,
    server: input.server,
  } satisfies GatewayConfig;
}
