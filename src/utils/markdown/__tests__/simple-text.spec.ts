/**
 * @file Tests for parsing simple text markdown content
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createStreamingMarkdownParser } from "../streaming-parser";
import type { MarkdownParseEvent } from "../types";

const SAMPLE_PATH = path.join(__dirname, "..", "__mocks__", "markdown-samples", "simple-text.md");

describe("StreamingMarkdownParser - simple-text.md", () => {
  it("should emit paragraph text events for plain text", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();
    const events: MarkdownParseEvent[] = [];

    for await (const event of parser.processChunk(content)) {
      events.push(event);
    }
    for await (const event of parser.complete()) {
      events.push(event);
    }

    // Should produce begin/delta/end events for text paragraphs
    const begins = events.filter((e) => e.type === "begin");
    const deltas = events.filter((e) => e.type === "delta");
    const ends = events.filter((e) => e.type === "end");

    expect(begins.length).toBeGreaterThan(0);
    expect(deltas.length).toBeGreaterThan(0);
    expect(ends.length).toBe(begins.length);
  });

  it("should handle the content without errors", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();

    // Should process without throwing
    // eslint-disable-next-line no-restricted-syntax -- test result tracking pattern
    let processed = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- event variable is unused but needed for iteration
      for await (const _event of parser.processChunk(content)) {
        // Just consume events
      }
      processed = true;
    } catch {
      processed = false;
    }

    expect(processed).toBe(true);
  });
});
