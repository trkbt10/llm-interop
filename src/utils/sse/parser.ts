/**
 * @file Server-Sent Events (SSE) parsing utilities for streaming responses.
 * Handles parsing of SSE-formatted JSON lines from various LLM provider APIs.
 */
/**
 * Parses a single Server-Sent Events line containing JSON data.
 * Handles common SSE formats including data: prefix and [DONE] sentinel.
 * @param line - Raw SSE line to parse
 * @returns Parsed JSON object, or undefined if the line should be ignored/invalid
 */
export function parseSSELine(line: string): unknown {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  const dataPrefix = /^data:\s*/i;
  const payload = (() => {
    if (dataPrefix.test(trimmed)) {
      return trimmed.replace(dataPrefix, "");
    }
    return trimmed;
  })();
  if (payload === "[DONE]") {
    return undefined;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}
