/**
 * @file Provider family heuristics for model routing.
 */
import type { ProviderFamily } from "./normalizer";

const FAMILY_TO_PROVIDER_TYPES: Record<ProviderFamily, readonly string[]> = {
  openai: ["openai", "azure-openai"],
  anthropic: ["claude", "anthropic"],
  google: ["gemini", "google"],
  groq: ["groq"],
  xai: ["xai", "grok"],
  ollama: ["ollama"],
  unknown: [],
};

/**
 * Returns provider type hints associated with a detected provider family.
 */
export function getProviderTypesForFamily(family: ProviderFamily): readonly string[] {
  return FAMILY_TO_PROVIDER_TYPES[family] ?? FAMILY_TO_PROVIDER_TYPES.unknown;
}
