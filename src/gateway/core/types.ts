/**
 * @file Shared gateway configuration types.
 */
import type { Provider } from "../../config/types";
import type { ModelGrade } from "../../model/model-grade-detector";

/**
 * Backend configuration enriched with gateway-specific routing metadata.
 */
export type GatewayBackendModelsConfig = {
  /** Explicit model identifiers routed to this backend. */
  exact?: string[];
  /** Model grades (high/mid/low) that this backend should handle. */
  grades?: ModelGrade[];
};

export type GatewayBackendConfig = {
  /** Unique identifier used to report which upstream handled a request. */
  id: string;
  /** Provider configuration passed to downstream adapters. */
  provider: Provider;
  /** Relative weight used for selection. Higher values receive more traffic. */
  weight?: number;
  /** Maximum concurrent requests allowed for this backend. */
  maxConcurrency?: number;
  /** Optional model routing hints for this backend. */
  models?: GatewayBackendModelsConfig;
};

export type GatewayRoutingConfig = {
  /**
   * Maximum time (in milliseconds) to wait for an available backend when all are saturated.
   * When omitted or invalid, waits indefinitely.
   */
  acquireTimeoutMs?: number;
};

export type GatewaySelectionRule = "exact" | "grade" | "provider";

export type GatewaySelectionConfig = {
  /** Ordered list of routing rules. Default: ["exact", "grade", "provider"]. */
  priority?: GatewaySelectionRule[];
  /** Allow the balancer to fall back to any backend if none of the rules match. */
  allowFallbackToAny?: boolean;
  /** Optional hints mapping detected provider families to backend IDs (or backend provider types). */
  providerHints?: Record<string, string[]>;
};

/**
 * Gateway configuration aggregating all known upstream backends by identifier.
 */
export type GatewayConfig = {
  backends: Record<string, GatewayBackendConfig>;
  routing?: GatewayRoutingConfig;
  selection?: GatewaySelectionConfig;
};
