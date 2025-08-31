/**
 * @file Factory for creating OpenAI-compatible clients for different providers
 */
import type { Provider } from "../config/types";
import { buildOpenAICompatibleClientForClaude } from "../adapters/claude-to-openai/responses-api/openai-compatible";
import { buildOpenAICompatibleClientForGemini } from "../adapters/gemini-to-openai/openai-compatible";
import { buildOpenAIPassthroughAdapter } from "../adapters/openai-compatible/openai-passthrough";
import { buildOpenAIGenericAdapter } from "../adapters/openai-compatible";
import type { OpenAICompatibleClient } from "./openai-client-types";

/**
 * Creates unified OpenAI-compatible clients for diverse LLM providers.
 * Abstracts away provider-specific implementation details to present a consistent
 * OpenAI-style interface regardless of the underlying service (Claude, Gemini, Grok, etc.).
 * Essential for enabling provider-agnostic LLM integrations and seamless provider switching.
 *
 * @param provider - Provider configuration specifying target LLM service and credentials
 * @param modelHint - Optional model identifier for optimizing client initialization
 * @returns OpenAI-compatible client instance ready for chat completions and model operations
 */
export function buildOpenAICompatibleClient(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  if (provider.type === "gemini") {
    return buildOpenAICompatibleClientForGemini(provider, modelHint);
  }
  if (provider.type === "grok") {
    // Ensure Grok has the correct base URL
    const grokProvider: Provider = {
      ...provider,
      baseURL: provider.baseURL ? provider.baseURL : "https://api.x.ai/v1",
    };
    return buildOpenAIGenericAdapter(grokProvider, modelHint);
  }
  if (provider.type === "claude") {
    return buildOpenAICompatibleClientForClaude(provider, modelHint);
  }

  // Use specific adapter for OpenAI, generic adapter for others
  if (provider.type === "openai") {
    return buildOpenAIPassthroughAdapter(provider, modelHint);
  }

  // Generic OpenAI-compatible providers
  return buildOpenAIGenericAdapter(provider, modelHint);
}
