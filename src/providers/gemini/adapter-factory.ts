/**
 * @file Factory for creating Gemini API adapters.
 * Provides OpenAI-compatible client interface for interacting with Google Gemini models.
 */

import type { Provider } from "../../config/types";
import type { OpenAICompatibleClient } from "../../adapters/openai-client-types";
import { buildOpenAICompatibleClientForGemini } from "../../adapters/gemini-to-openai/openai-compatible";

// API key selection centralized in shared/select-api-key

/**
 * Creates an OpenAI-compatible client adapter for Gemini API.
 * @param provider - Provider configuration containing API credentials
 * @param modelHint - Optional model hint for selecting specific Gemini models
 * @returns OpenAI-compatible client interface
 */
export function buildGeminiAdapter(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  return buildOpenAICompatibleClientForGemini(provider, modelHint);
}
