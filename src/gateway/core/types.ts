/**
 * @file Shared gateway configuration types.
 */
import type { Provider } from "../../config/types";
import type { ModelGrade } from "../../model/model-grade-detector";

/**
 * Model grade classification for gateway routing.
 * @see ModelGrade
 */
export type GatewayModelGrade = ModelGrade;

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

export type GatewayServerRuntimeOptions = {
  /** Port number to listen on. */
  port?: number;
  /** Host address to bind to. */
  host?: string;
  /** If true, fails immediately when the port is in use instead of trying the next port. */
  strictPort?: boolean;
  /** CORS configuration. Set to true to allow all origins, or provide specific CORS options. */
  cors?: boolean | {
    /** Allowed origins. Can be a string, array of strings, or a function. */
    origin?: string | string[] | ((origin: string) => boolean);
    /** Allowed HTTP methods. */
    methods?: string[];
    /** Allowed headers. */
    allowedHeaders?: string[];
    /** Exposed headers. */
    exposedHeaders?: string[];
    /** Allow credentials. */
    credentials?: boolean;
    /** Max age for preflight requests in seconds. */
    maxAge?: number;
  };
};

/**
 * Gateway configuration input format (with backends as array).
 */
export type GatewayConfigInput = {
  backends: GatewayBackendConfig[];
  routing?: GatewayRoutingConfig;
  selection?: GatewaySelectionConfig;
  server?: GatewayServerRuntimeOptions;
};

/**
 * Gateway configuration with normalized backend record for internal use.
 * Extends input format with an indexed backend map.
 */
export type GatewayConfig = GatewayConfigInput & {
  /** Indexed map of backends by lowercase ID for efficient lookup. */
  backendRecord: Record<string, GatewayBackendConfig>;
};
