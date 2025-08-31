/**
 * @file Structured table output tests
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createStreamingMarkdownParser } from "../streaming-parser";
import type { MarkdownParseEvent, BeginEvent, EndEvent } from "../types";

const SAMPLE_PATH = path.join(__dirname, "..", "__mocks__", "markdown-samples", "table-examples.md");

describe("Structured table output", () => {
  it("emits nested table > thead/tbody > row > col elements", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser({ tableOutputMode: "structured" });
    const events: MarkdownParseEvent[] = [];

    for await (const ev of parser.processChunk(content)) {
      events.push(ev);
    }

    // Find table begin/end
    const tableBegin = events.find(
      (e): e is BeginEvent => e.type === "begin" && (e as BeginEvent).elementType === "table",
    );
    expect(tableBegin).toBeDefined();
    const tableEnd = events.find((e): e is EndEvent => e.type === "end" && e.elementId === tableBegin?.elementId);
    expect(tableEnd).toBeDefined();

    // thead/row/col exists
    const theadBegin = events.find(
      (e): e is BeginEvent => e.type === "begin" && (e as BeginEvent).elementType === "thead",
    );
    expect(theadBegin).toBeDefined();
    const headerColBegins = events
      .filter((e): e is BeginEvent => e.type === "begin" && (e as BeginEvent).elementType === "col")
      .slice(0, 3);
    const headerColEnds = events
      .filter((e): e is EndEvent => e.type === "end")
      .filter((end) => headerColBegins.some((b) => b.elementId === end.elementId));
    const headerTexts = headerColEnds.map((e) => e.finalContent);
    expect(headerTexts).toEqual(["Name", "Age", "City"]);
    const headerAlignments = headerColBegins.map((b) => b.metadata?.alignment);
    expect(headerAlignments).toEqual(["left", "center", "right"]);
    const headerIdx = headerColBegins.map((b) => b.metadata?.index);
    expect(headerIdx).toEqual([0, 1, 2]);

    // Body rows contain Alice/Bob
    const colEnds = events
      .filter((e): e is EndEvent => e.type === "end")
      .filter((end) =>
        events.some(
          (b): b is BeginEvent =>
            b.type === "begin" && b.elementId === end.elementId && (b as BeginEvent).elementType === "col",
        ),
      );
    const colTexts = colEnds.map((e) => e.finalContent);
    expect(colTexts).toEqual(expect.arrayContaining(["Alice", "30", "Tokyo", "Bob", "9", "Kyoto"]));
  });
});
