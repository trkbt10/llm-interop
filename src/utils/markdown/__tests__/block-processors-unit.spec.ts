/**
 * @file Unit tests for individual block processor functions
 */
import {
  processCodeBlock,
  processNonCodeBlock,
  handleDetectedBlock,
  accumulateBlockContent,
  type DetectedBlock,
} from "../block-processors";
import { createParserState, createBlockState } from "../parser-state";

describe("Block Processors - Unit Tests", () => {
  describe("processCodeBlock", () => {
    it("should handle empty buffer", async () => {
      const state = createParserState();
      state.buffer = "";
      state.processedIndex = 0;

      const codeBlock = createBlockState("test-1", "code", "```", "```");
      state.activeBlocks.push(codeBlock);

      const events = [];
      for await (const event of processCodeBlock(state, codeBlock)) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
      expect(state.processedIndex).toBe(0); // Should not advance
    });

    it("should handle buffer without newline or end marker", async () => {
      const state = createParserState();
      state.buffer = "code content";
      state.processedIndex = 0;

      const codeBlock = createBlockState("test-1", "code", "```", "```");
      state.activeBlocks.push(codeBlock);

      const events = [];
      for await (const event of processCodeBlock(state, codeBlock)) {
        events.push(event);
      }

      // Should consume all content to prevent infinite loops and emit incremental delta
      expect(events).toHaveLength(1); // One delta for the buffered content
      expect(events[0].type).toBe("delta");
      expect((events[0] as { content: string }).content).toBe("code content");
      expect(state.processedIndex).toBe(12); // Should advance to consume all content
      expect(codeBlock.content).toBe("code content"); // Content should be buffered
    });

    it("should handle code with newline", async () => {
      const state = createParserState();
      state.buffer = "code line 1\n";
      state.processedIndex = 0;

      const codeBlock = createBlockState("test-1", "code", "```", "```");
      state.activeBlocks.push(codeBlock);

      const events = [];
      for await (const event of processCodeBlock(state, codeBlock)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("delta");
      expect(state.processedIndex).toBe(12); // Should advance
    });

    it("should handle code with end marker", async () => {
      const state = createParserState();
      state.buffer = "code content\n```\n";
      state.processedIndex = 0;

      const codeBlock = createBlockState("test-1", "code", "```", "```");
      state.activeBlocks.push(codeBlock);

      const events = [];
      for await (const event of processCodeBlock(state, codeBlock)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("end");
      expect(state.activeBlocks).toHaveLength(0); // Block should be removed
      expect(state.processedIndex).toBeGreaterThan(0); // Should advance
    });

    it("should handle immediate end marker", async () => {
      const state = createParserState();
      state.buffer = "```\n";
      state.processedIndex = 0;

      const codeBlock = createBlockState("test-1", "code", "```", "```");
      state.activeBlocks.push(codeBlock);

      const events = [];
      for await (const event of processCodeBlock(state, codeBlock)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("end");
      expect(state.activeBlocks).toHaveLength(0);
      expect(state.processedIndex).toBe(4); // Should advance past ```\n
    });
  });

  describe("processNonCodeBlock", () => {
    it("should handle empty buffer", async () => {
      const state = createParserState();
      state.buffer = "";
      state.processedIndex = 0;

      const events = [];
      for await (const event of processNonCodeBlock(state)) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
      expect(state.processedIndex).toBe(0); // Should not advance on empty buffer
    });

    it("should advance when no blocks detected", async () => {
      const state = createParserState();
      state.buffer = "a";
      state.processedIndex = 0;

      const events = [];
      for await (const event of processNonCodeBlock(state)) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
      expect(state.processedIndex).toBe(1); // Should advance by 1
    });

    it("should handle multiple characters", async () => {
      const state = createParserState();
      state.buffer = "abc";
      state.processedIndex = 0;

      // Process first character
      const events1 = [];
      for await (const event of processNonCodeBlock(state)) {
        events1.push(event);
      }

      expect(state.processedIndex).toBe(1);

      // Process second character
      const events2 = [];
      for await (const event of processNonCodeBlock(state)) {
        events2.push(event);
      }

      expect(state.processedIndex).toBe(2);
    });
  });

  describe("handleDetectedBlock", () => {
    it("should handle single-line block", async () => {
      const state = createParserState();
      state.buffer = "# Header\n";
      state.processedIndex = 0;

      const detected: DetectedBlock = {
        type: "header",
        content: "Header",
        matchLength: 9,
        metadata: { level: 1 },
      };

      const events = [];
      for await (const event of handleDetectedBlock(state, detected, state.buffer)) {
        events.push(event);
      }

      expect(events).toHaveLength(3); // begin, delta, end
      expect(events[0].type).toBe("begin");
      expect(events[1].type).toBe("delta");
      expect(events[2].type).toBe("end");
      expect(state.processedIndex).toBe(9);
    });

    it("should handle multi-line block", async () => {
      const state = createParserState();
      state.buffer = "```js\n";
      state.processedIndex = 0;

      const detected: DetectedBlock = {
        type: "code",
        matchLength: 6,
        startMarker: "```",
        endMarker: "```",
        metadata: { language: "js" },
      };

      const events = [];
      for await (const event of handleDetectedBlock(state, detected, state.buffer)) {
        events.push(event);
      }

      expect(events).toHaveLength(1); // Only begin event
      expect(events[0].type).toBe("begin");
      expect(state.activeBlocks).toHaveLength(1);
      expect(state.processedIndex).toBe(6);
    });
  });

  describe("accumulateBlockContent", () => {
    it("should accumulate single character", async () => {
      const state = createParserState();
      state.buffer = "a";
      state.processedIndex = 0;

      const block = createBlockState("test-1", "text", "", undefined);
      state.activeBlocks.push(block);

      const events = [];
      for await (const event of accumulateBlockContent(state, "a")) {
        events.push(event);
      }

      expect(events).toHaveLength(1); // Incremental delta for added character
      expect(events[0].type).toBe("delta");
      expect((events[0] as { content: string }).content).toBe("a");
      expect(block.content).toBe("a");
      expect(state.processedIndex).toBe(1);
    });

    it("should not emit standalone trailing newline delta for text (defer to flush)", async () => {
      const state = createParserState();
      state.buffer = "line\n";
      state.processedIndex = 4;

      const block = createBlockState("test-1", "text", "", undefined);
      block.content = "line";
      state.activeBlocks.push(block);

      const events = [];
      for await (const event of accumulateBlockContent(state, "\n")) {
        events.push(event);
      }

      // For text blocks, trailing single newline at buffer end is not emitted immediately
      expect(events).toHaveLength(0);
      expect(block.content).toBe("line\n");
      expect(state.processedIndex).toBe(5);
    });
  });
});
