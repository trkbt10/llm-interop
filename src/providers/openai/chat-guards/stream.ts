/**
 * @file Type guards for OpenAI Chat Completion streaming types
 *
 * Why: Provides type guards for stream-related types including chunks
 * and stream event handling.
 */

import type {
  ChatCompletionChunk,
} from "openai/resources/chat/completions";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if a value is a ChatCompletionChunk
 */
export function isChatCompletionChunk(value: unknown): value is ChatCompletionChunk {
  if (!isObject(value)) {
    return false;
  }
  const chunk = value as Record<string, unknown>;
  return (
    typeof chunk.id === "string" &&
    chunk.object === "chat.completion.chunk" &&
    typeof chunk.created === "number" &&
    typeof chunk.model === "string" &&
    Array.isArray(chunk.choices)
  );
}

/**
 * Check if a value is a stream of ChatCompletionChunk
 */
export function isChatCompletionStream(value: unknown): value is AsyncIterable<ChatCompletionChunk> {
  if (!isObject(value)) {
    return false;
  }
  return Symbol.asyncIterator in (value as Record<string, unknown>);
}

/**
 * Check if a chunk has finish reason
 */
export function hasFinishReason(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.some(choice => choice.finish_reason !== null && choice.finish_reason !== undefined);
}

/**
 * Check if a chunk is the final chunk (has finish reason)
 */
export function isFinalChunk(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.every(choice => choice.finish_reason !== null);
}

/**
 * Check if a chunk has delta content
 */
export function hasDeltaContent(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.some(choice => 
    choice.delta && choice.delta.content !== null && choice.delta.content !== undefined
  );
}

/**
 * Check if a chunk has delta tool calls
 */
export function hasDeltaToolCalls(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.some(choice => 
    choice.delta && choice.delta.tool_calls !== undefined && Array.isArray(choice.delta.tool_calls)
  );
}

/**
 * Check if a chunk has delta function call (deprecated)
 */
export function hasDeltaFunctionCall(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.some(choice => 
    choice.delta && choice.delta.function_call !== null && choice.delta.function_call !== undefined
  );
}

/**
 * Check if a chunk has delta refusal
 */
export function hasDeltaRefusal(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.some(choice => 
    choice.delta && choice.delta.refusal !== null && choice.delta.refusal !== undefined
  );
}

/**
 * Check if a chunk has delta audio
 */
export function hasDeltaAudio(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.some(choice => {
    if (!choice.delta) return false;
    const delta = choice.delta as Record<string, unknown>;
    return delta.audio !== null && delta.audio !== undefined;
  });
}

/**
 * Check if a chunk has usage information
 */
export function hasUsage(chunk: ChatCompletionChunk): boolean {
  return chunk.usage !== null && chunk.usage !== undefined;
}

/**
 * Check if a chunk has service tier information
 */
export function hasServiceTier(chunk: ChatCompletionChunk): boolean {
  return chunk.service_tier !== null && chunk.service_tier !== undefined;
}

/**
 * Extract content from chunk deltas
 */
export function extractDeltaContent(chunk: ChatCompletionChunk): string[] {
  return chunk.choices
    .filter(choice => choice.delta && choice.delta.content)
    .map(choice => choice.delta.content as string);
}

/**
 * Get finish reasons from chunk
 */
export function getFinishReasons(chunk: ChatCompletionChunk): (string | null)[] {
  return chunk.choices.map(choice => choice.finish_reason);
}

/**
 * Ensure all items in a stream are valid ChatCompletionChunks
 */
export async function* ensureChatCompletionStream(
  src: AsyncIterable<unknown>,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  for await (const item of src) {
    if (isChatCompletionChunk(item)) {
      yield item;
      continue;
    }
    throw new TypeError("Stream chunk is not a valid ChatCompletionChunk");
  }
}