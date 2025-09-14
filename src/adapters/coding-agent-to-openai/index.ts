/**
 * @file Coding-agent adapter entrypoint
 * Expose a builder that takes Provider config directly (no env handling here).
 */
import { buildOpenAICompatibleClientForCodingAgent } from "./openai-compatible";
import type { OpenAICompatibleClient } from "../openai-client-types";
import type { Provider } from "../../config/types";

export function buildCodingAgentClient(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  return buildOpenAICompatibleClientForCodingAgent(provider, modelHint);
}

export default {
  buildCodingAgentClient,
};
