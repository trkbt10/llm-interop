/**
 * @file Gateway configuration summary utilities.
 */
import type {
  GatewayConfig,
  GatewayConfigInput,
  GatewayBackendConfig,
  GatewayRoutingConfig,
  GatewaySelectionConfig,
} from "../core/types";
import { createGatewayConfig } from "./gateway-config";

type BackendSummary = Pick<GatewayBackendConfig, "id" | "weight" | "maxConcurrency"> & {
  provider: GatewayBackendConfig["provider"]["type"];
  model?: GatewayBackendConfig["provider"]["model"];
  supportedModels: {
    exact: string[];
    grades: NonNullable<GatewayBackendConfig["models"]>["grades"] extends (infer T)[] ? T[] : string[];
  };
};

export type GatewayConfigSummary = {
  totalBackends: number;
  backends: BackendSummary[];
  routing?: GatewayRoutingConfig;
  selection?: GatewaySelectionConfig;
};

function isNormalizedGatewayConfig(
  config: GatewayConfig | GatewayConfigInput,
): config is GatewayConfig {
  return !Array.isArray((config as GatewayConfigInput).backends);
}

function normalizeGatewayConfig(config: GatewayConfig | GatewayConfigInput): GatewayConfig {
  if (isNormalizedGatewayConfig(config)) {
    return config;
  }
  return createGatewayConfig(config);
}

/**
 * Generates a human-readable summary of the gateway configuration.
 */
export function summarizeGatewayConfig(config: GatewayConfig | GatewayConfigInput): GatewayConfigSummary {
  const normalized = normalizeGatewayConfig(config);
  const backendEntries = Object.values(normalized.backendRecord);

  return {
    totalBackends: backendEntries.length,
    backends: backendEntries.map((backend) => ({
      id: backend.id,
      provider: backend.provider.type,
      model: backend.provider.model,
      weight: backend.weight,
      maxConcurrency: backend.maxConcurrency,
      supportedModels: {
        exact: backend.models?.exact ?? [],
        grades: backend.models?.grades ?? [],
      },
    })),
    routing: normalized.routing,
    selection: normalized.selection,
  };
}
