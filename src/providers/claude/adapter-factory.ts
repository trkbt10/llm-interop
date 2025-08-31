/**
 * @file Factory for creating Claude API adapters.
 * Provides OpenAI-compatible client interface for interacting with Claude models.
 */

import type { Provider } from "../../config/types";
import type { OpenAICompatibleClient } from "../../adapters/openai-client-types";
import { buildOpenAICompatibleClientForClaude } from "../../adapters/claude-to-openai/responses-api/openai-compatible";

/**
 * Creates an OpenAI-compatible client adapter for Claude API.
 * @param provider - Provider configuration containing API credentials
 * @param modelHint - Optional model hint for selecting specific Claude models
 * @returns OpenAI-compatible client interface
 */
export function buildClaudeAdapter(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  return buildOpenAICompatibleClientForClaude(provider, modelHint);
}
