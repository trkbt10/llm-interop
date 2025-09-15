/**
 * @file Tests for parsing markdown code blocks
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createStreamingMarkdownParser } from "../streaming-parser";
import type { MarkdownParseEvent, BeginEvent, EndEvent } from "../types";

const SAMPLE_PATH = path.join(__dirname, "..", "__mocks__", "markdown-samples", "code-blocks.md");

describe("StreamingMarkdownParser - code-blocks.md", () => {
  it("should detect exactly 2 code blocks", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();
    const events: MarkdownParseEvent[] = [];

    for await (const event of parser.processChunk(content)) {
      events.push(event);
    }
    for await (const event of parser.complete()) {
      events.push(event);
    }

    const codeBeginEvents = events.filter((e) => e.type === "begin" && e.elementType === "code");
    expect(codeBeginEvents).toHaveLength(2);
  });

  it("should detect correct languages for code blocks", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();
    const events: MarkdownParseEvent[] = [];

    for await (const event of parser.processChunk(content)) {
      events.push(event);
    }
    for await (const event of parser.complete()) {
      events.push(event);
    }

    const beginEvents = events.filter((e): e is BeginEvent => e.type === "begin" && e.elementType === "code");

    expect(beginEvents[0].metadata?.language).toBe("python");
    expect(beginEvents[1].metadata?.language).toBe("javascript");
  });

  it("should preserve double newlines inside code blocks", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();
    const events: MarkdownParseEvent[] = [];

    for await (const event of parser.processChunk(content)) {
      events.push(event);
    }

    const codeBegins = events.filter((e): e is BeginEvent => e.type === "begin" && e.elementType === "code");
    const endEvents = events.filter((e): e is EndEvent => e.type === "end");
    const codeEnd1 = endEvents.find((e) => e.elementId === codeBegins[0].elementId)!;
    const codeEnd2 = endEvents.find((e) => e.elementId === codeBegins[1].elementId)!;

    // Python code block
    expect(codeEnd1.finalContent).toContain("# This has double newlines inside");
    // Allow optional indentation on empty lines
    expect(/\n\s*\n\s*/.test(codeEnd1.finalContent)).toBe(true);

    // JavaScript code block
    expect(codeEnd2.finalContent).toContain("// Multiple newlines here too");
    // Allow at least two consecutive empty lines
    expect(/\n\s*\n\s*/.test(codeEnd2.finalContent)).toBe(true);
  });

  it("should have matching begin and end events", async () => {
    const content = await readFile(SAMPLE_PATH, "utf-8");
    const parser = createStreamingMarkdownParser();
    const events: MarkdownParseEvent[] = [];

    for await (const event of parser.processChunk(content)) {
      events.push(event);
    }
    for await (const event of parser.complete()) {
      events.push(event);
    }

    const beginEvents = events.filter((e) => e.type === "begin");
    const endEvents = events.filter((e) => e.type === "end");

    expect(beginEvents.length).toBe(endEvents.length);

    // Check that element IDs match
    beginEvents.forEach((begin) => {
      const matchingEnd = endEvents.find((end) => end.elementId === begin.elementId);
      expect(matchingEnd).toBeDefined();
    });
  });
});
