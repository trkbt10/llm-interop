/**
 * @file Ensure quote and list block deltas are incremental
 */
import { createStreamingMarkdownParser } from "../streaming-parser";

describe("Incremental deltas for non-code blocks", () => {
  it("quote block emits per-line deltas without accumulation", async () => {
    const parser = createStreamingMarkdownParser();
    const text = "> hello\n> world\n\n";

    const deltas: { [id: string]: string[] } = {};
    const events: any[] = [];
    for (let i = 0; i < text.length; i += 4) {
      const chunk = text.slice(i, i + 4);
      for await (const ev of parser.processChunk(chunk)) {
        events.push(ev);
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
    // Debug print to inspect actual deltas when failing in CI
    // eslint-disable-next-line no-console
    console.log("quote begins:", events.filter(e=>e.type==='begin'));
    console.log("quote deltas:", deltaLists.map((a) => JSON.stringify(a.join(""))));
    const found = deltaLists.some((arr) => arr.join("").replace(/\n\n$/, "\n") === "hello\nworld\n");
    expect(found).toBe(true);
  });

  it("list block emits per-line deltas without accumulation", async () => {
    const parser = createStreamingMarkdownParser();
    const text = "- item1\n- item2\n\n";

    const deltas: { [id: string]: string[] } = {};
    const events: any[] = [];
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      for await (const ev of parser.processChunk(chunk)) {
        events.push(ev);
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
    // eslint-disable-next-line no-console
    console.log("list begins:", events.filter(e=>e.type==='begin'));
    // eslint-disable-next-line no-console
    console.log("list deltas:", deltaLists.map((a) => JSON.stringify(a.join(""))));
    const found = deltaLists.some((arr) => arr.join("").replace(/\n\n$/, "\n") === "item1\nitem2\n");
    expect(found).toBe(true);
  });
});
