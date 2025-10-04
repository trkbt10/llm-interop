/**
 * @file Gateway configuration summary utilities.
 */
import type { GatewayConfig, GatewayConfigInput, GatewayModelGrade, GatewaySelectionRule } from "../core/types";
import { createGatewayConfig } from "./gateway-config";

export type GatewayConfigSummary = {
  totalBackends: number;
  backends: Array<{
    id: string;
    provider: string;
    model?: string;
    weight?: number;
    maxConcurrency?: number;
    supportedModels: {
      exact: string[];
      grades: GatewayModelGrade[];
    };
  }>;
  routing?: {
    acquireTimeoutMs?: number;
  };
  selection?: {
    priority?: GatewaySelectionRule[];
    allowFallbackToAny?: boolean;
    providerHints?: Record<string, string[]>;
  };
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
  const backendEntries = Object.values(normalized.backends);

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
