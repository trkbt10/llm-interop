/**
 * @file Ensure quote and list block deltas are incremental
 */
import { createStreamingMarkdownParser } from "../streaming-parser";

describe("Incremental deltas for non-code blocks", () => {
  it("quote block emits per-line deltas without accumulation", async () => {
    const parser = createStreamingMarkdownParser();
    const text = "> hello\n> world\n\n";

    const deltas: { [id: string]: string[] } = {};
    for (let i = 0; i < text.length; i += 4) {
      const chunk = text.slice(i, i + 4);
      for await (const ev of parser.processChunk(chunk)) {
        if (ev.type === "delta") {
          if (!deltas[ev.elementId]) {
            deltas[ev.elementId] = [];
          }
          deltas[ev.elementId].push(ev.content);
        }
      }
    }

    // There should be at least one block with two deltas matching lines without "> "
    const deltaLists = Object.values(deltas).filter((arr) => arr.length > 0);
    expect(deltaLists.length).toBeGreaterThan(0);
    const found = deltaLists.some((arr) => arr.join("") === "hello\nworld\n");
    expect(found).toBe(true);
  });

  it("list block emits per-line deltas without accumulation", async () => {
    const parser = createStreamingMarkdownParser();
    const text = "- item1\n- item2\n\n";

    const deltas: { [id: string]: string[] } = {};
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      for await (const ev of parser.processChunk(chunk)) {
        if (ev.type === "delta") {
          if (!deltas[ev.elementId]) {
            deltas[ev.elementId] = [];
          }
          deltas[ev.elementId].push(ev.content);
        }
      }
    }

    const deltaLists = Object.values(deltas).filter((arr) => arr.length > 0);
    expect(deltaLists.length).toBeGreaterThan(0);
    const found = deltaLists.some((arr) => arr.join("") === "item1\nitem2\n");
    expect(found).toBe(true);
  });
});
