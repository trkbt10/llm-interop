/**
 * @file Tests for parsing markdown tables
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createStreamingMarkdownParser } from "../streaming-parser";
import type { BeginEvent, EndEvent, MarkdownParseEvent } from "../types";

const SAMPLE_PATH = path.join(__dirname, "..", "__mocks__", "markdown-samples", "table-examples.md");

describe("StreamingMarkdownParser - table-examples.md", () => {
  it("detects a table block with correct alignment metadata", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();
    const events: MarkdownParseEvent[] = [];

    for await (const ev of parser.processChunk(content)) {
      events.push(ev);
    }

    const begins = events.filter((e): e is BeginEvent => e.type === "begin" && e.elementType === "table");
    expect(begins.length).toBeGreaterThan(0);

    // Verify alignments metadata on first table
    const first = begins[0];
    expect(Array.isArray(first.metadata?.alignments)).toBe(true);
    expect(first.metadata?.alignments).toEqual(["left", "center", "right"]);
  });

  it("closes the table and contains rows in final content", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();
    const events: MarkdownParseEvent[] = [];

    for await (const ev of parser.processChunk(content)) {
      events.push(ev);
    }

    const begins = events.filter((e): e is BeginEvent => e.type === "begin" && e.elementType === "table");
    const ends = events.filter((e): e is EndEvent => e.type === "end");

    expect(begins.length).toBeGreaterThan(0);
    // Find matching end for first table
    const tableBegin = begins[0];
    const tableEnd = ends.find((e) => e.elementId === tableBegin.elementId);
    expect(tableEnd).toBeDefined();

    // Final content should include table rows
    expect(tableEnd?.finalContent).toContain("| Alice |  30 |  Tokyo |");
    expect(tableEnd?.finalContent).toContain("| Bob   |   9 |  Kyoto |");
  });
});
