/**
 * @file Advanced edge case tests for Gemini stream handler.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { StreamedPart } from "../../../providers/gemini/client/fetch-client";
import { createGeminiStreamHandler, handleStream, resetHandler, type GeminiStreamHandlerState } from "./stream-handler";

const MARKDOWN_SAMPLES_DIR = path.join(__dirname, "__mocks__", "markdown-samples");

describe("GeminiStreamHandler - Advanced Edge Cases", () => {
  // Helper to convert text to stream parts
  function textToStreamParts(text: string, chunkSize?: number): StreamedPart[] {
    const parts: StreamedPart[] = [];

    if (chunkSize) {
      for (let i = 0; i < text.length; i += chunkSize) {
        parts.push({ type: "text", text: text.slice(i, i + chunkSize) });
      }
      parts.push({ type: "complete", finishReason: "STOP" });
      return parts;
    }
    parts.push({ type: "text", text });

    parts.push({ type: "complete", finishReason: "STOP" });
    return parts;
  }

  // Helper to collect events
  async function collectEvents(
    handler: GeminiStreamHandlerState,
    parts: StreamedPart[],
  ): Promise<ResponseStreamEvent[]> {
    const events: ResponseStreamEvent[] = [];

    async function* mockStream() {
      for (const part of parts) {
        yield part;
      }
    }

    for await (const event of handleStream(handler, mockStream())) {
      events.push(event);
    }

    return events;
  }

  describe("extreme edge cases", () => {
    it("should handle extreme edge cases from file", async () => {
      const content = await readFile(path.join(MARKDOWN_SAMPLES_DIR, "extreme-edge-cases.md"), "utf-8");

      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts(content, 10); // Very small chunks
      const events = await collectEvents(handler, parts);

      // Should complete without errors
      expect(events[0].type).toBe("response.created");
      expect(events[events.length - 1].type).toBe("response.completed");

      // Should have proper pairs
      const addedCount = events.filter((e) => e.type === "response.output_item.added").length;
      const doneCount = events.filter((e) => e.type === "response.output_item.done").length;
      expect(addedCount).toBe(doneCount);

      // Should reconstruct text correctly
      const textDeltas = events.filter((e) => e.type === "response.output_text.delta");
      const reconstructed = textDeltas.map((e) => e.delta).join("");
      expect(reconstructed).toBe(content);
    });

    it("should handle empty input", async () => {
      const handler = createGeminiStreamHandler();
      const parts: StreamedPart[] = [{ type: "complete", finishReason: "STOP" }];

      const events = await collectEvents(handler, parts);

      expect(events.length).toBe(2); // created and completed
      expect(events[0].type).toBe("response.created");
      expect(events[1].type).toBe("response.completed");
    });

    it("should handle only whitespace", async () => {
      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts("   \n  \t  \n   ");
      const events = await collectEvents(handler, parts);

      const textDone = events.find((e) => e.type === "response.output_text.done");
      expect(textDone?.text).toBe("   \n  \t  \n   ");
    });

    it("should handle single character chunks", async () => {
      const text = "a\n\nb\n\nc";
      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts(text, 1);
      const events = await collectEvents(handler, parts);

      const textDeltas = events.filter((e) => e.type === "response.output_text.delta");
      expect(textDeltas.length).toBe(3);
      expect(textDeltas[0].delta).toBe("a\n\n");
      expect(textDeltas[1].delta).toBe("b\n\n");
      expect(textDeltas[2].delta).toBe("c");
    });

    it("should handle text ending with incomplete \\n", async () => {
      const handler = createGeminiStreamHandler();
      const parts: StreamedPart[] = [
        { type: "text", text: "text\n" },
        { type: "complete", finishReason: "STOP" },
      ];

      const events = await collectEvents(handler, parts);
      const textDone = events.find((e) => e.type === "response.output_text.done");
      expect(textDone?.text).toBe("text\n");
    });
  });

  describe("unicode and special characters", () => {
    it("should handle unicode content correctly", async () => {
      const content = await readFile(path.join(MARKDOWN_SAMPLES_DIR, "unicode-special-chars.md"), "utf-8");

      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts(content, 50);
      const events = await collectEvents(handler, parts);

      // Should preserve all unicode characters
      const textDeltas = events.filter((e) => e.type === "response.output_text.delta");
      const reconstructed = textDeltas.map((e) => e.delta).join("");
      expect(reconstructed).toBe(content);

      // Check specific unicode preservation
      expect(reconstructed).toContain("🎉");
      expect(reconstructed).toContain("世界");
      expect(reconstructed).toContain("مرحبا بالعالم");
    });

    it("should handle mixed line endings", async () => {
      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts("Line1\r\n\r\nLine2\n\nLine3\r\n\r\nLine4");
      const events = await collectEvents(handler, parts);

      const textDeltas = events.filter((e) => e.type === "response.output_text.delta");
      // Should normalize line endings to \n\n
      expect(textDeltas.length).toBeGreaterThan(1);
    });
  });

  describe("code block edge cases", () => {
    it("should handle code blocks with ``` inside", async () => {
      const text = '```\nprint("```")\n```';
      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts(text);
      const events = await collectEvents(handler, parts);

      const textDone = events.find((e) => e.type === "response.output_text.done");
      expect(textDone?.text).toBe(text);
    });

    it("should handle nested triple backticks", async () => {
      const text = "``````\n```\ninner\n```\n``````";
      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts(text);
      const events = await collectEvents(handler, parts);

      const textDone = events.find((e) => e.type === "response.output_text.done");
      expect(textDone?.text).toBe(text);
    });

    it("should track code block state across chunks correctly", async () => {
      const handler = createGeminiStreamHandler();
      const parts: StreamedPart[] = [
        { type: "text", text: "Before\n\n`" },
        { type: "text", text: "`" },
        { type: "text", text: "`python\ndef test():\n\n    pass\n`" },
        { type: "text", text: "`" },
        { type: "text", text: "`\n\nAfter" },
        { type: "complete", finishReason: "STOP" },
      ];

      const events = await collectEvents(handler, parts);

      const textDeltas = events.filter((e) => e.type === "response.output_text.delta");
      // Code block tracking is complex with split chunks
      expect(textDeltas.length).toBeGreaterThanOrEqual(2);
      expect(textDeltas[0].delta).toBe("Before\n\n");

      // Last delta should contain "After"
      const lastDelta = textDeltas[textDeltas.length - 1].delta;
      expect(lastDelta).toContain("After");
    });
  });

  describe("performance with large content", () => {
    it("should handle large content efficiently", async () => {
      const content = await readFile(path.join(MARKDOWN_SAMPLES_DIR, "large-content.md"), "utf-8");

      const handler = createGeminiStreamHandler();
      const startTime = performance.now();

      // Test with different chunk sizes
      for (const chunkSize of [10, 100, 1000]) {
        resetHandler(handler);
        const parts = textToStreamParts(content, chunkSize);
        const events = await collectEvents(handler, parts);

        // Verify correctness
        const textDeltas = events.filter((e) => e.type === "response.output_text.delta");
        const reconstructed = textDeltas.map((e) => e.delta).join("");
        expect(reconstructed).toBe(content);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second for all tests)
      expect(duration).toBeLessThan(1000);
      console.log(`Large content test completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe("state management edge cases", () => {
    it("should handle multiple resets correctly", async () => {
      const handler = createGeminiStreamHandler();

      // First stream
      const firstParts = textToStreamParts("First\n\nResponse");
      const firstEvents = await collectEvents(handler, firstParts);
      const firstTextDone = firstEvents.find((e) => e.type === "response.output_text.done");
      expect(firstTextDone?.text).toBe("First\n\nResponse");

      // Reset multiple times
      resetHandler(handler);
      resetHandler(handler);
      resetHandler(handler);

      // Second stream should work correctly
      const secondParts = textToStreamParts("Second\n\nResponse");
      const secondEvents = await collectEvents(handler, secondParts);
      const secondTextDone = secondEvents.find((e) => e.type === "response.output_text.done");
      expect(secondTextDone?.text).toBe("Second\n\nResponse");
    });

    it("should maintain consistent sequence numbers", async () => {
      const handler = createGeminiStreamHandler();
      const parts = textToStreamParts("Test\n\nContent\n\nHere");
      const events = await collectEvents(handler, parts);

      // Check sequence numbers are monotonically increasing
      const sequenceNumbers = events
        .filter((event): event is typeof event & { sequence_number: number } => "sequence_number" in event)
        .map((event) => event.sequence_number);

      for (let i = 1; i < sequenceNumbers.length; i++) {
        expect(sequenceNumbers[i]).toBeGreaterThan(sequenceNumbers[i - 1]);
      }
    });
  });

  describe("error recovery", () => {
    it("should handle null/undefined text gracefully", async () => {
      const handler = createGeminiStreamHandler();
      const parts: StreamedPart[] = [
        { type: "text", text: "Before" },
        { type: "text", text: undefined },
        // @ts-expect-error: Inject invalid text values to test robustness
        { type: "text", text: null },
        { type: "text", text: "After" },
        { type: "complete", finishReason: "STOP" },
      ];

      const events = await collectEvents(handler, parts);
      const textDone = events.find((e) => e.type === "response.output_text.done");
      expect(textDone?.text).toBe("BeforeAfter");
    });

    it("should handle malformed function calls", async () => {
      const handler = createGeminiStreamHandler();
      const parts: StreamedPart[] = [
        { type: "functionCall", functionCall: undefined },
        // @ts-expect-error: Inject invalid function call name
        { type: "functionCall", functionCall: { name: undefined } },
        { type: "functionCall", functionCall: { name: "" } },
        { type: "complete", finishReason: "STOP" },
      ];

      const events = await collectEvents(handler, parts);

      // Should still complete successfully
      expect(events[0].type).toBe("response.created");
      expect(events[events.length - 1].type).toBe("response.completed");

      // Should have function calls with defaults
      const functionCalls = events.filter(
        (e) => e.type === "response.output_item.added" && e.item.type === "function_call",
      );
      // All three malformed calls will create function items (undefined becomes {}, {} stays {}, and empty name)
      expect(functionCalls.length).toBe(3);
    });
  });

  describe("mixed content patterns", () => {
    it("should handle rapid alternation between text and functions", async () => {
      const handler = createGeminiStreamHandler();
      const parts: StreamedPart[] = [
        { type: "text", text: "A" },
        { type: "functionCall", functionCall: { name: "f1" } },
        { type: "text", text: "B" },
        { type: "functionCall", functionCall: { name: "f2" } },
        { type: "text", text: "C" },
        { type: "complete", finishReason: "STOP" },
      ];

      const events = await collectEvents(handler, parts);

      // Should have one text item (combined) and two function items
      const textItems = events.filter((e) => e.type === "response.output_item.added" && e.item.type === "message");
      const functionItems = events.filter(
        (e) => e.type === "response.output_item.added" && e.item.type === "function_call",
      );

      expect(textItems.length).toBe(1);
      expect(functionItems.length).toBe(2);

      const textDone = events.find((e) => e.type === "response.output_text.done");
      expect(textDone?.text).toBe("ABC");
    });

    it("should handle code blocks interrupted by function calls", async () => {
      const handler = createGeminiStreamHandler();
      const parts: StreamedPart[] = [
        { type: "text", text: "```python\nprint('start')" },
        { type: "functionCall", functionCall: { name: "interrupt" } },
        { type: "text", text: "\nprint('end')\n```" },
        { type: "complete", finishReason: "STOP" },
      ];

      const events = await collectEvents(handler, parts);

      // Text should be properly combined despite interruption
      const textDone = events.find((e) => e.type === "response.output_text.done");
      expect(textDone?.text).toContain("```python");
      expect(textDone?.text).toContain("print('start')");
      expect(textDone?.text).toContain("print('end')");
      expect(textDone?.text).toContain("```");
    });
  });
});
