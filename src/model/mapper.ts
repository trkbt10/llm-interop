/**
 * @file Model mapping and provider resolution utilities
 */
import type { Provider, ModelMapping } from "../config/types";
import { detectModelGrade } from "./model-grade-detector";
import { getCachedModelIds } from "./list-cache";
// API key resolution happens inside adapters; no env fallback here


// RoutingConfig removed: provider mapping now expects explicit provider inputs when needed.

function getProviderModelMappingFrom(provider: Provider | undefined | null): ModelMapping | undefined {
  return provider?.modelMapping;
}

function normalizeModelName(name?: string): string | undefined {
  if (!name) {
    return undefined;
  }
  // eslint-disable-next-line no-restricted-syntax -- String processing requires mutation
  let s = String(name).trim();
  if (s.startsWith("models/")) {
    s = s.slice("models/".length);
  }
  return s;
}

function pickByGrade(grade: "high" | "mid" | "low", provider: Provider | undefined | null): string | undefined {
  const modelMapping = getProviderModelMappingFrom(provider);
  return modelMapping?.byGrade?.[grade];
}

function tryMapByGrade(modelName: string | undefined, provider: Provider | undefined | null): string | undefined {
  if (!modelName) {
    return undefined;
  }
  const grade = detectModelGrade(modelName);
  return pickByGrade(grade, provider);
}

function resolveWithDefaults(
  sourceModel: string | undefined,
  defaultModel: string | undefined,
  provider: Provider | undefined | null,
): string {
  // Try grade mapping for provided source model
  {
    const mapped = tryMapByGrade(sourceModel, provider);
    if (mapped) {
      return mapped;
    }
  }
  // If no source provided, try mapping the configured default model
  if (!sourceModel && defaultModel) {
    const mapped = tryMapByGrade(defaultModel, provider);
    if (mapped) {
      return mapped;
    }
  }
  // Fallback to original or default
  return sourceModel ? sourceModel : defaultModel ? defaultModel : "";
}

/**
 * Maps a source model name to a target provider's roughly equivalent model.
 * If a lister is provided, prefers picking from actual provider `listModels()` results
 * by matching grade, avoiding hardcoded defaults.
 */
export function mapModelToProvider(params: {
  targetProvider: Provider;
  sourceModel?: string;
}): string {
  const provider = params.targetProvider;
  const sourceModel = normalizeModelName(params.sourceModel);

  // 1) Provider-specific alias mapping
  const modelMapping = getProviderModelMappingFrom(provider);
  if (modelMapping?.aliases) {
    if (sourceModel) {
      if (modelMapping.aliases[sourceModel]) {
        return modelMapping.aliases[sourceModel];
      }
    }
  }

  // 2) Grade-based mapping and fallbacks consolidated
  const defaultModel = provider.model;
  return resolveWithDefaults(sourceModel, defaultModel, provider);
}

/**
 * Async model resolution that uses provider.listModels() to select by grade.
 * Falls back to config and minimal defaults if the list is unavailable.
 */
export async function resolveModelForProvider(params: {
  provider: Provider;
  sourceModel?: string;
  modelHint?: string;
  listAvailableModels?: () => Promise<string[]>; // optional override for tests
}): Promise<string> {
  if (params.provider.model) {
    // If provider has a model, use it directly
    return params.provider.model;
  }
  const provider = params.provider;
  const sourceModel = normalizeModelName(params.sourceModel);

  // Aliases first
  const modelMapping = getProviderModelMappingFrom(provider);
  if (modelMapping?.aliases) {
    if (sourceModel) {
      if (modelMapping.aliases[sourceModel]) {
        return modelMapping.aliases[sourceModel];
      }
    }
  }

  // Load provider models and pick by grade
  try {
    const useLister = (() => {
      if (params.listAvailableModels) {
        return params.listAvailableModels;
      }
      return async () => await listModelsForProvider(params.provider, params.modelHint);
    })();
    const ids = (await useLister()).map(normalizeModelName).filter(Boolean) as string[];
    if (ids.length > 0) {
      const desiredSource = (() => {
        if (sourceModel) {
          return sourceModel;
        }
        return "";
      })();
      const grade = detectModelGrade(desiredSource);
      const graded = ids.filter((id) => detectModelGrade(id) === grade);
      const pool = graded.length ? graded : ids;
      const picked = pickBestModelId(pool);
      if (picked) {
        return picked;
      }
    }
  } catch {
    // ignore list errors and fall back
  }

  // Fallbacks consolidated
  const defaultModel = provider.model;
  return resolveWithDefaults(sourceModel, defaultModel, provider);
}

function pickBestModelId(ids: string[]): string | undefined {
  // Prefer ids containing 'latest'
  const latest = ids.filter((id) => /latest/i.test(id));
  if (latest.length) {
    return sortByRecency(latest)[0];
  }
  // Otherwise sort by recency heuristics
  const sorted = sortByRecency(ids);
  return sorted[0];
}

function sortByRecency(ids: string[]): string[] {
  // Heuristic: extract largest numeric token (e.g., dates like 20241022 or version numbers), desc
  const score = (id: string): number => {
    const numbers = id.match(/\d{6,}|\d+/g);
    const numbersArray = numbers ? numbers : [];
    const max = numbersArray.reduce((acc, n) => Math.max(acc, parseInt(n, 10) ? parseInt(n, 10) : 0), 0);
    // Small bonus for contains 'pro' or 'sonnet' vs 'mini'/'lite'
    const bonus = /pro|opus|sonnet|ultra/i.test(id) ? 100 : 0;
    const malus = /mini|lite|nano|tiny|fast/i.test(id) ? -50 : 0;
    return max + bonus + malus;
  };
  return [...ids].sort((a, b) => score(b) - score(a));
}

// No provider-prefix hardcoding; mapping always flows through grade/aliases and live list.

async function listModelsForProvider(provider: Provider, modelHint?: string): Promise<string[]> {
  return await getCachedModelIds(provider, modelHint);
}
