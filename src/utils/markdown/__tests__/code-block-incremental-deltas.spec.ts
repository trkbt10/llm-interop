/**
 * @file Ensure code block deltas are incremental (non-accumulating)
 */
import { createStreamingMarkdownParser } from "../streaming-parser";
import type { MarkdownParseEvent } from "../types";

describe("Code block incremental deltas", () => {
  it("emits only new chunk content per delta while streaming", async () => {
    const parser = createStreamingMarkdownParser();

    const chunk1 = "```python\n# Large\n";
    const chunk2 = "code line 2\n";
    const chunk3 = "```";

    const deltas: string[] = [];

    for await (const ev of parser.processChunk(chunk1)) {
      if (ev.type === "delta") {
        deltas.push(ev.content);
      }
    }

    for await (const ev of parser.processChunk(chunk2)) {
      if (ev.type === "delta") {
        deltas.push(ev.content);
      }
    }

    for await (const ev of parser.processChunk(chunk3)) {
      if (ev.type === "delta") {
        deltas.push(ev.content);
      }
    }

    // Should have two delta chunks from the two completed lines inside the code block
    expect(deltas).toEqual(["# Large\n", "code line 2\n"]);

    // Completing should not add more delta for code block
    const postComplete: MarkdownParseEvent[] = [];
    for await (const ev of parser.complete()) {
      postComplete.push(ev);
    }
    expect(postComplete.some((e) => e.type === "delta")).toBe(false);
  });
});
