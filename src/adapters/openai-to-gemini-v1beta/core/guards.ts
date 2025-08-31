/**
 * @file Type guards and small helpers
 */
// Note: OpenAI-specific guards are defined under providers/openai/responses-guards

/**
 * Whether a value implements AsyncIterable (used to detect streaming responses).
 */
export function isAsyncIterable<T = unknown>(obj: unknown): obj is AsyncIterable<T> {
  if (obj === null || obj === undefined) {
    return false;
  }
  const anyObj = obj as { [Symbol.asyncIterator]?: unknown };
  return typeof anyObj[Symbol.asyncIterator] === "function";
}

/**
 * Type guard for Responses API delta events carrying text output.
 */
// Keep only provider-agnostic helpers here
