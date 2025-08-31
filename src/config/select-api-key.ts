/**
 * @file API key selection logic for multi-key provider configurations.
 * Handles model-specific API key selection based on provider configuration.
 */

import type { Provider } from "./types";

/**
 * Selects the appropriate API key based on provider configuration and model hint.
 * Supports model-specific keys through prefix matching for multi-key scenarios.
 * @param provider - Provider configuration containing API key(s)
 * @param modelHint - Optional model name to match against prefix rules
 * @returns Selected API key or undefined if none found
 */
export function selectApiKey(provider: Provider, modelHint?: string): string | undefined {
  const direct = provider.apiKey ? provider.apiKey : undefined;
  if (direct) {
    return direct;
  }

  if (modelHint && provider.api?.keyByModelPrefix) {
    const entries = Object.entries(provider.api.keyByModelPrefix).sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, apiKey] of entries) {
      if (modelHint.startsWith(prefix)) {
        return apiKey;
      }
    }
  }

  return undefined;
}
