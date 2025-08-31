/**
 * @file Ensure concatenated deltas reconstruct finalContent
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createStreamingMarkdownParser } from "../streaming-parser";
import type { EndEvent } from "../types";

const SAMPLE_PATH = path.join(__dirname, "..", "__mocks__", "markdown-samples", "simple-text.md");

describe("Delta accumulation matches finalContent", () => {
  it("reconstructs finalContent for text paragraphs in simple-text.md", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser({ maxDeltaChunkSize: 12 });

    const deltasById = new Map<string, string[]>();
    const ends: EndEvent[] = [];

    for await (const ev of parser.processChunk(content)) {
      if (ev.type === "delta") {
        const arr = deltasById.get(ev.elementId) ?? [];
        arr.push(ev.content);
        deltasById.set(ev.elementId, arr);
      } else if (ev.type === "end") {
        ends.push(ev);
      }
    }

    // Also flush complete() to ensure closure behavior is correct
    for await (const ev of parser.complete()) {
      if (ev.type === "end") {
        ends.push(ev as EndEvent);
      }
    }

    // Validate for all text blocks
    const textEnds = ends.filter((e) => {
      // No direct elementType on EndEvent; find matching begin via collected deltas
      return deltasById.has(e.elementId);
    });

    for (const e of textEnds) {
      const deltas = deltasById.get(e.elementId) ?? [];
      const reconstructed = deltas.join("");
      expect(reconstructed).toBe(e.finalContent);
      // Ensure not all deltas are whitespace-only (guards against space-only streaming)
      const hasNonSpace = deltas.some((d) => /\S/.test(d));
      expect(hasNonSpace).toBe(true);
    }

    // Specifically assert the last paragraph content is present and reconstructed via deltas
    const last = textEnds[textEnds.length - 1];
    expect(last.finalContent).toBe("This is the third paragraph.");
    const lastDeltas = deltasById.get(last.elementId) ?? [];
    expect(lastDeltas.join("")).toBe("This is the third paragraph.");
  });
});
