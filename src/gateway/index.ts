/**
 * @file Public entry point for gateway utilities.
 */
import type {
  GatewayBackendConfig as GatewayBackendConfigInternal,
  GatewayBackendModelsConfig as GatewayBackendModelsConfigInternal,
  GatewayConfig as GatewayConfigInternal,
  GatewayRoutingConfig as GatewayRoutingConfigInternal,
  GatewaySelectionConfig as GatewaySelectionConfigInternal,
  GatewaySelectionRule as GatewaySelectionRuleInternal,
} from "./core/types";
import { createGatewayConfig as createGatewayConfigInternal } from "./config/gateway-config";
import { createProviderBalancer as createProviderBalancerInternal } from "./core/balancer";
import type {
  AcquireOptions as AcquireOptionsInternal,
  ProviderFetch as ProviderFetchInternal,
  ProviderLease as ProviderLeaseInternal,
} from "./core/balancer";
import { createBackendResolver as createBackendResolverInternal } from "./core/resolver";
import type { BackendResolution as BackendResolutionInternal } from "./core/resolver";
import { createGatewayForwarder as createGatewayForwarderInternal } from "./core/router-base";
import type {
  ResolveModelFn as ResolveModelFnInternal,
  ResolveModelResult as ResolveModelResultInternal,
} from "./core/router-base";
import { createOpenAIGateway as createOpenAIGatewayInternal } from "./surfaces/openai";
import { createAnthropicGateway as createAnthropicGatewayInternal } from "./surfaces/anthropic";
import { createGeminiGateway as createGeminiGatewayInternal } from "./surfaces/gemini";

export type GatewayConfig = GatewayConfigInternal;
export type GatewayBackendConfig = GatewayBackendConfigInternal;
export type GatewayBackendModelsConfig = GatewayBackendModelsConfigInternal;
export type GatewayRoutingConfig = GatewayRoutingConfigInternal;
export type GatewaySelectionConfig = GatewaySelectionConfigInternal;
export type GatewaySelectionRule = GatewaySelectionRuleInternal;
export type ProviderLease = ProviderLeaseInternal;
export type ProviderFetch = ProviderFetchInternal;
export type AcquireOptions = AcquireOptionsInternal;
export type BackendResolution = BackendResolutionInternal;
export type ResolveModelFn = ResolveModelFnInternal;
export type ResolveModelResult = ResolveModelResultInternal;

/**
 * Builds a normalized gateway configuration from user input.
 */
export function createGatewayConfig(input: Parameters<typeof createGatewayConfigInternal>[0]) {
  return createGatewayConfigInternal(input);
}

/**
 * Creates a Hono application for OpenAI-compatible routing.
 */
export function createOpenAIGateway(config: GatewayConfigInternal) {
  return createOpenAIGatewayInternal(config);
}

/**
 * Creates a Hono application for Anthropic-compatible routing.
 */
export function createAnthropicGateway(config: GatewayConfigInternal) {
  return createAnthropicGatewayInternal(config);
}

/**
 * Creates a Hono application for Gemini-compatible routing.
 */
export function createGeminiGateway(config: GatewayConfigInternal) {
  return createGeminiGatewayInternal(config);
}

/**
 * Convenience wrapper that produces a fetch handler for the OpenAI surface.
 */
export function createOpenAIGatewayFetch(config: GatewayConfigInternal) {
  const app = createOpenAIGatewayInternal(config);
  return app.fetch.bind(app);
}

/**
 * Convenience wrapper that produces a fetch handler for the Anthropic surface.
 */
export function createAnthropicGatewayFetch(config: GatewayConfigInternal) {
  const app = createAnthropicGatewayInternal(config);
  return app.fetch.bind(app);
}

/**
 * Convenience wrapper that produces a fetch handler for the Gemini surface.
 */
export function createGeminiGatewayFetch(config: GatewayConfigInternal) {
  const app = createGeminiGatewayInternal(config);
  return app.fetch.bind(app);
}

/**
 * Factory for provider balancers with explicit fetch factories.
 */
export function createProviderBalancer(
  config: GatewayConfigInternal,
  fetchFactory: Parameters<typeof createProviderBalancerInternal>[1],
) {
  return createProviderBalancerInternal(config, fetchFactory);
}

/**
 * Creates a backend resolver for model-to-backend mapping.
 */
export function createBackendResolver(config: GatewayConfigInternal) {
  return createBackendResolverInternal(config);
}

/**
 * Creates a request forwarder that consults the resolver and balancer.
 */
export function createGatewayForwarder(
  config: GatewayConfigInternal,
  options: Parameters<typeof createGatewayForwarderInternal>[1],
) {
  return createGatewayForwarderInternal(config, options);
}
