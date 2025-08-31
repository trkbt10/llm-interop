/**
 * @file SSE response builder utilities for different providers
 */
import { sseResponseFromAsyncIterable } from "../../../utils/sse/writer";

export type SSEFormat = "openai" | "claude" | "gemini";

/**
 * Creates an SSE response from an async iterable with provider-specific formatting
 */
export function createSSEResponse(
  stream: AsyncIterable<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameter reserved for future format implementations
  _format: SSEFormat = "openai",
): Response {
  return sseResponseFromAsyncIterable(stream);
}

/**
 * Type guard to check if a value is an async iterable
 */
export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) {
    return false;
  }
  const maybe = value as { [Symbol.asyncIterator]?: unknown } | null;
  const iterator = maybe ? maybe[Symbol.asyncIterator] : undefined;
  return typeof iterator === "function";
}

/**
 * Determines if a request should be streamed based on parameters
 */
export function shouldStream(params: { stream?: boolean } | unknown): boolean {
  if (typeof params !== "object" || params === null) {
    return false;
  }
  return !!(params as { stream?: boolean }).stream;
}
