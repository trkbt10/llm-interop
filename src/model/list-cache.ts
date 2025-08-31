/**
 * @file Cached model list retrieval for different providers
 */
import type { Provider } from "../config/types";
import { buildOpenAICompatibleClient } from "../adapters/openai-client";

type CacheEntry = {
  data?: string[];
  fetchedAt?: number;
  loading?: Promise<string[]>;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new WeakMap<Provider, CacheEntry>();

function now() {
  return Date.now();
}

function isFreshRaw(entry: CacheEntry | undefined): boolean {
  if (!entry) {
    return false;
  }
  if (entry.fetchedAt === undefined || entry.data === undefined) {
    return false;
  }
  return now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Retrieves available model identifiers from a provider with intelligent caching.
 * Reduces API call overhead by maintaining a 5-minute cache of model lists,
 * ensuring applications can quickly enumerate available models without
 * repeatedly hitting provider APIs. Critical for model selection UIs and validation.
 *
 * @param provider - LLM provider configuration for model enumeration
 * @param modelHint - Optional model suggestion for provider client initialization
 * @returns Promise resolving to array of available model identifiers
 */
export async function getCachedModelIds(provider: Provider, modelHint?: string): Promise<string[]> {
  const existing = cache.get(provider) as CacheEntry | undefined;
  if (isFreshRaw(existing)) {
    return existing!.data as string[];
  }
  if (existing && existing.loading) {
    return existing.loading;
  }

  const newEntry: CacheEntry = existing ? existing : {};
  const load = (async () => {
    try {
      const client = buildOpenAICompatibleClient(provider, modelHint);
      const res = await client.models.list();
      const ids = res.data.map((m) => m.id);
      newEntry.data = ids;
      newEntry.fetchedAt = now();
      newEntry.loading = undefined;
      return ids;
    } catch {
      // On error, do not update fetchedAt; allow next caller to retry
      newEntry.loading = undefined;
      return [];
    }
  })();
  newEntry.loading = load;
  cache.set(provider, newEntry);
  return load;
}

/**
 * Invalidates cached model list for a specific provider to force fresh retrieval.
 * Useful when provider configurations change or new models become available,
 * ensuring applications see up-to-date model lists without waiting for cache expiry.
 *
 * @param provider - Provider configuration whose model cache should be cleared
 */
export function clearModelListCacheFor(provider: Provider): void {
  cache.delete(provider);
}

/**
 * Attempts to clear all provider model caches for memory management.
 * Limited by WeakMap's design - relies on garbage collection to fully clear.
 * Primarily useful for testing scenarios or when provider configurations change globally.
 */
export function clearAllModelListCache(): void {
  // WeakMap cannot be iterated; rely on GC or restart to fully clear.
}
