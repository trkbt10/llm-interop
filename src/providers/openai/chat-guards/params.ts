/**
 * @file Type guards for OpenAI Chat Completion parameters
 *
 * Why: Provides type guards for distinguishing between different parameter types
 * used in the Chat Completions API.
 */

import type {
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionStreamOptions,
  ChatCompletionUpdateParams,
  ChatCompletionListParams,
} from "openai/resources/chat/completions";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if params are for streaming
 */
export function isChatParamsStreaming(
  params: ChatCompletionCreateParams
): params is ChatCompletionCreateParamsStreaming {
  return params.stream === true;
}

/**
 * Check if params are for non-streaming
 */
export function isChatParamsNonStreaming(
  params: ChatCompletionCreateParams
): params is ChatCompletionCreateParamsNonStreaming {
  return params.stream !== true;
}

/**
 * Check if a value is ChatCompletionCreateParams
 */
export function isChatCompletionCreateParams(value: unknown): value is ChatCompletionCreateParams {
  if (!isObject(value)) {
    return false;
  }
  const params = value as Record<string, unknown>;
  // Messages and model are required
  return Array.isArray(params.messages) && typeof params.model === "string";
}

/**
 * Check if a value is ChatCompletionStreamOptions
 */
export function isChatCompletionStreamOptions(value: unknown): value is ChatCompletionStreamOptions {
  if (!isObject(value)) {
    return false;
  }
  const options = value as Record<string, unknown>;
  // include_usage is optional but if present must be boolean
  if (options.include_usage !== undefined && typeof options.include_usage !== "boolean") {
    return false;
  }
  return true;
}

/**
 * Check if a value is ChatCompletionUpdateParams
 */
export function isChatCompletionUpdateParams(value: unknown): value is ChatCompletionUpdateParams {
  if (!isObject(value)) {
    return false;
  }
  const params = value as Record<string, unknown>;
  // metadata is the only field
  return params.metadata !== undefined && isObject(params.metadata);
}

/**
 * Check if a value is ChatCompletionListParams
 */
export function isChatCompletionListParams(value: unknown): value is ChatCompletionListParams {
  if (!isObject(value)) {
    return false;
  }
  const params = value as Record<string, unknown>;
  // Optional fields with specific types
  if (params.after !== undefined && typeof params.after !== "string") {
    return false;
  }
  if (params.before !== undefined && typeof params.before !== "string") {
    return false;
  }
  if (params.limit !== undefined && typeof params.limit !== "number") {
    return false;
  }
  if (params.order !== undefined && params.order !== "asc" && params.order !== "desc") {
    return false;
  }
  return true;
}

/**
 * Check if params have tools configured
 */
export function hasTools(params: ChatCompletionCreateParams): boolean {
  return params.tools !== undefined && Array.isArray(params.tools) && params.tools.length > 0;
}

/**
 * Check if params have functions configured (deprecated)
 */
export function hasFunctions(params: ChatCompletionCreateParams): boolean {
  return params.functions !== undefined && Array.isArray(params.functions) && params.functions.length > 0;
}

/**
 * Check if params have response format configured
 */
export function hasResponseFormat(params: ChatCompletionCreateParams): boolean {
  return params.response_format !== undefined && params.response_format !== null;
}

/**
 * Check if params have audio configuration
 */
export function hasAudioParams(params: ChatCompletionCreateParams): boolean {
  return params.audio !== undefined && params.audio !== null;
}

/**
 * Check if params have modalities configured
 */
export function hasModalities(params: ChatCompletionCreateParams): boolean {
  return params.modalities !== undefined && Array.isArray(params.modalities) && params.modalities.length > 0;
}

/**
 * Check if params have prediction content
 */
export function hasPrediction(params: ChatCompletionCreateParams): boolean {
  return params.prediction !== undefined && params.prediction !== null;
}

/**
 * Check if params have store configuration
 */
export function hasStore(params: ChatCompletionCreateParams): boolean {
  return params.store !== undefined && params.store !== null;
}

/**
 * Check if params have metadata
 */
export function hasMetadata(params: ChatCompletionCreateParams): boolean {
  return params.metadata !== undefined && params.metadata !== null;
}

/**
 * Check if params have reasoning effort configured
 */
export function hasReasoningEffort(params: ChatCompletionCreateParams): boolean {
  return params.reasoning_effort !== undefined && params.reasoning_effort !== null;
}