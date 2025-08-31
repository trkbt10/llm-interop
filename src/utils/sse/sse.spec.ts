/**
 * @file Tests for SSE writer/reader/parser utilities
 */
import { serializeSSE, createSSEStream } from "./writer";
import { parseSSEStream } from "./reader";
import { parseSSELine } from "./parser";

function toStreamFromString(s: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(s));
      controller.close();
    },
  });
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) {
    out.push(v);
  }
  return out;
}

describe("SSE writer", () => {
  it("serializes SSE events with event name and data", () => {
    const s = serializeSSE({ event: "message", data: { hello: "world" } });
    expect(s).toBe("event: message\n" + 'data: {"hello":"world"}\n\n');
  });
});

describe("parseSSELine", () => {
  describe("basic parsing", () => {
    it("should parse valid JSON with data prefix", () => {
      const line = 'data: {"message": "hello", "type": "text"}';
      const result = parseSSELine(line);
      expect(result).toEqual({ message: "hello", type: "text" });
    });

    it("should parse valid JSON without data prefix", () => {
      const line = '{"status": "success", "value": 42}';
      const result = parseSSELine(line);
      expect(result).toEqual({ status: "success", value: 42 });
    });

    it("should parse case-insensitive data prefix", () => {
      const line = 'DATA: {"case": "insensitive"}';
      const result = parseSSELine(line);
      expect(result).toEqual({ case: "insensitive" });
    });

    it("should handle data prefix with extra whitespace", () => {
      const line = 'data:   {"extra": "spaces"}';
      const result = parseSSELine(line);
      expect(result).toEqual({ extra: "spaces" });
    });
  });

  describe("special values", () => {
    it("should return undefined for [DONE] sentinel", () => {
      const line = "data: [DONE]";
      const result = parseSSELine(line);
      expect(result).toBeUndefined();
    });

    it("should return undefined for [DONE] without data prefix", () => {
      const line = "[DONE]";
      const result = parseSSELine(line);
      expect(result).toBeUndefined();
    });

    it("should parse JSON primitives", () => {
      expect(parseSSELine("data: true")).toBe(true);
      expect(parseSSELine("data: false")).toBe(false);
      expect(parseSSELine("data: null")).toBeNull();
      expect(parseSSELine("data: 123")).toBe(123);
      expect(parseSSELine('data: "string"')).toBe("string");
    });

    it("should parse JSON arrays", () => {
      const line = 'data: [1, 2, {"nested": "object"}]';
      const result = parseSSELine(line);
      expect(result).toEqual([1, 2, { nested: "object" }]);
    });
  });

  describe("edge cases", () => {
    it("should return undefined for empty lines", () => {
      expect(parseSSELine("")).toBeUndefined();
      expect(parseSSELine("   ")).toBeUndefined();
      expect(parseSSELine("\t\n")).toBeUndefined();
    });

    it("should return undefined for invalid JSON", () => {
      expect(parseSSELine("data: {invalid json}")).toBeUndefined();
      expect(parseSSELine("data: [1,2,")).toBeUndefined();
      expect(parseSSELine('data: {"incomplete":')).toBeUndefined();
    });

    it("should handle lines with only data prefix", () => {
      expect(parseSSELine("data:")).toBeUndefined();
      expect(parseSSELine("data: ")).toBeUndefined();
    });

    it("should handle non-JSON text content", () => {
      expect(parseSSELine("data: plain text")).toBeUndefined();
      expect(parseSSELine("some random text")).toBeUndefined();
    });

    it("should handle complex nested JSON", () => {
      const line = 'data: {"deeply": {"nested": {"object": {"with": ["arrays", {"and": "more", "objects": true}]}}}}';
      const result = parseSSELine(line);
      expect(result).toEqual({
        deeply: {
          nested: {
            object: {
              with: ["arrays", { and: "more", objects: true }],
            },
          },
        },
      });
    });
  });

  describe("real-world examples", () => {
    it("should parse OpenAI-style streaming response", () => {
      const line =
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"delta":{"content":"Hello"},"index":0,"finish_reason":null}]}';
      const result = parseSSELine(line);
      expect(result).toMatchObject({
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        choices: expect.arrayContaining([
          expect.objectContaining({
            delta: { content: "Hello" },
            index: 0,
          }),
        ]),
      });
    });

    it("should parse Claude-style streaming response", () => {
      const line = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}';
      const result = parseSSELine(line);
      expect(result).toEqual({
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "text_delta",
          text: "Hello",
        },
      });
    });
  });
});

describe("SSE writer + reader roundtrip", () => {
  it("streams typed and SSEEventLike events and parses back to payloads", async () => {
    async function* gen() {
      yield { event: "alpha", data: { foo: 1 } };
      yield { type: "custom.type", value: 42 };
      yield { event: "nullish", data: null };
    }

    const stream = createSSEStream(gen(), { includeEndEvent: false });
    const items = await collect(parseSSEStream(stream));
    // null payload is skipped by reader
    expect(items).toEqual([{ foo: 1 }, { type: "custom.type", value: 42 }]);
  });

  it("parses raw SSE text with multiple frames", async () => {
    const raw = [
      "event: message\n" + 'data: {"a":1}\n\n',
      "event: something\n" + 'data: {"b":2}\n\n',
      "event: message\n" + "data: null\n\n",
    ].join("");
    const stream = toStreamFromString(raw);
    const items = await collect(parseSSEStream(stream));
    expect(items).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
