/**
 * @file Type guards for OpenAI Responses API create parameters
 *
 * Why: Provides type-safe runtime checks for distinguishing between
 * streaming and non-streaming response creation parameters.
 */

import type {
  ResponseCreateParams,
  ResponseCreateParamsStreaming,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";

/**
 * Type guard to check if params are for streaming
 * @param params - The ResponseCreateParams to validate
 * @returns True if params are ResponseCreateParamsStreaming
 */
export function isResponseParamsStreaming(params: ResponseCreateParams): params is ResponseCreateParamsStreaming {
  return params.stream === true;
}

/**
 * Type guard to check if params are for non-streaming
 * @param params - The ResponseCreateParams to validate
 * @returns True if params are ResponseCreateParamsNonStreaming
 */
export function isResponseParamsNonStreaming(params: ResponseCreateParams): params is ResponseCreateParamsNonStreaming {
  return params.stream !== true;
}