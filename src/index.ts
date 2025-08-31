/**
 * @file Main public entry for llm-interop.
 * Keeps exports focused on core, commonly used APIs.
 */

export const version = "0.1.0";

// Core client builder and types
export { buildOpenAICompatibleClient } from "./adapters/openai-client";
export type { OpenAICompatibleClient } from "./adapters/openai-client-types";
export type {
  ResponseCreateParams,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "./adapters/openai-client-types";

// OpenAI-compatible adapters entry (generic/passthrough)
export { buildOpenAIGenericAdapter } from "./adapters/openai-compatible";
