/**
 * @file SSE (Server-Sent Events) reader utilities
 * Consumes a text/event-stream ReadableStream and yields parsed JSON payloads.
 */

import { parseSSELine } from "./parser";

export type SSEStreamData = Record<string, unknown> | undefined;

/**
 * Parses a ReadableStream of SSE frames and yields parsed payloads.
 * Frames are expected to be separated by double newlines, and have a single
 * `data: ...` line containing JSON.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<NonNullable<SSEStreamData>, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  // eslint-disable-next-line no-restricted-syntax -- required for streaming buffer management
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // Process complete SSE messages (separated by double newlines)
      // eslint-disable-next-line no-restricted-syntax -- tight loop for SSE parsing
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);

        // Parse SSE frame with potentially multiple lines (event:, data:, etc.)
        const lines = raw.split("\n");
        const dataLine = lines.find((line) => line.startsWith("data:"));
        if (dataLine) {
          const payload = parseSSELine(dataLine);
          if (payload) {
            yield payload as NonNullable<SSEStreamData>;
          }
        }
      }
    }
    // Flush any trailing buffer
    const tail = buffer.trim();
    if (tail) {
      const lines = tail.split("\n");
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (dataLine) {
        const payload = parseSSELine(dataLine);
        if (payload) {
          yield payload as NonNullable<SSEStreamData>;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
