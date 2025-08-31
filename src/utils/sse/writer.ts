/**
 * @file SSE (Server-Sent Events) writer utilities
 * Provides helpers to serialize events and build a ReadableStream/Response
 * for text/event-stream outputs.
 */

export type SSEPayload = Record<string, unknown> | null;

export type SSEEventLike = {
  // Canonical SSE event name
  event: string;
  // JSON-serializable payload
  data: SSEPayload;
};

/**
 * Serializes an SSE event to a text/event-stream frame.
 */
export function serializeSSE(event: SSEEventLike): string {
  const name = event.event ? event.event : "message";
  const payload = event.data === undefined ? null : event.data;
  return `event: ${name}\n` + `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Creates a ReadableStream<Uint8Array> from an async iterable of events.
 * If the iterable yields plain objects with a `type` field, it will be used
 * as the SSE `event` name and the object itself becomes the `data`.
 */
export function createSSEStream(
  events: AsyncIterable<unknown>,
  options?: { includeEndEvent?: boolean },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const includeEndEvent = options?.includeEndEvent ?? true;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const anyEvent of events) {
          controller.enqueue(encoder.encode(toFrame(anyEvent)));
        }
        if (includeEndEvent) {
          controller.enqueue(encoder.encode(serializeSSE({ event: "stream_end", data: {} })));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(serializeSSE({ event: "error", data: { message: msg } })));
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Builds a Response object with proper SSE headers from an async iterable.
 */
export function sseResponseFromAsyncIterable(events: AsyncIterable<unknown>): Response {
  const body = createSSEStream(events);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

function isSSEEventLike(v: unknown): v is SSEEventLike {
  if (!v) {
    return false;
  }
  if (typeof v !== "object") {
    return false;
  }
  const obj = v as Record<string, unknown>;
  if (!("event" in obj)) {
    return false;
  }
  return "data" in obj;
}

function isTypedObject(v: unknown): v is { type: string } & Record<string, unknown> {
  if (!v) {
    return false;
  }
  if (typeof v !== "object") {
    return false;
  }
  const obj = v as Record<string, unknown>;
  return typeof obj.type === "string";
}

function toFrame(anyEvent: unknown): string {
  if (isSSEEventLike(anyEvent)) {
    return serializeSSE(anyEvent);
  }
  if (isTypedObject(anyEvent)) {
    return serializeSSE({ event: anyEvent.type, data: anyEvent as Record<string, unknown> });
  }
  return serializeSSE({ event: "message", data: anyEvent as Record<string, unknown> });
}
