/**
 * @file Tests for markdown parser utility functions
 */
import {
  cleanupBuffer,
  findPattern,
  extractLines,
  isWhitespace,
  countLeadingWhitespace,
  dedentLines,
  escapeRegex,
  createEndMarkerRegex,
  normalizeLineEndings,
  startsWithAt,
  parseCodeBlockMetadata,
} from "./parser-utils";
import type { ParserState, BlockState } from "./parser-state";
import { createParserState } from "./parser-state";

/**
 * Creates a mock block state for testing purposes.
 * @returns Mock block state with minimal required properties
 */
function createMockBlockState(): BlockState {
  return {
    id: "test-block-1",
    type: "code",
    content: "",
    startMarker: "```",
    endMarker: "```",
    contentStartIndex: 5,
    lastEmittedLength: 0,
  };
}

describe("parser-utils", () => {
  describe("cleanupBuffer", () => {
    it("should clean buffer when threshold is exceeded and no active blocks", () => {
      const state: ParserState = createParserState();
      state.buffer = "0123456789abcdefghijklmnopqrstuvwxyz";
      state.processedIndex = 15;
      state.activeBlocks = [];
      state.config = { maxBufferSize: 10 };

      cleanupBuffer(state);

      expect(state.buffer).toBe("fghijklmnopqrstuvwxyz");
      expect(state.processedIndex).toBe(0);
    });

    it("should not clean buffer when active blocks exist", () => {
      const state: ParserState = createParserState();
      state.buffer = "0123456789abcdefghijklmnopqrstuvwxyz";
      state.processedIndex = 15;
      state.activeBlocks = [createMockBlockState()];
      state.config = { maxBufferSize: 10 };

      const originalBuffer = state.buffer;
      cleanupBuffer(state);

      expect(state.buffer).toBe(originalBuffer);
      expect(state.processedIndex).toBe(15);
    });

    it("should not clean buffer when below threshold", () => {
      const state: ParserState = createParserState();
      state.buffer = "0123456789";
      state.processedIndex = 5;
      state.activeBlocks = [];
      state.config = { maxBufferSize: 10 };

      const originalBuffer = state.buffer;
      cleanupBuffer(state);

      expect(state.buffer).toBe(originalBuffer);
      expect(state.processedIndex).toBe(5);
    });
  });

  describe("findPattern", () => {
    it("should find string pattern", () => {
      const result = findPattern("hello world", "world");
      expect(result).toEqual({ index: 6, match: "world" });
    });

    it("should find string pattern with start index", () => {
      const result = findPattern("hello world world", "world", 7);
      expect(result).toEqual({ index: 12, match: "world" });
    });

    it("should return undefined when string pattern not found", () => {
      const result = findPattern("hello world", "xyz");
      expect(result).toBeUndefined();
    });

    it("should find regex pattern", () => {
      const result = findPattern("hello 123 world", /\d+/);
      expect(result).toEqual({ index: 6, match: "123" });
    });

    it("should find regex pattern with start index", () => {
      const result = findPattern("123 hello 456", /\d+/, 4);
      expect(result).toEqual({ index: 10, match: "456" });
    });

    it("should return undefined when regex pattern not found", () => {
      const result = findPattern("hello world", /\d+/);
      expect(result).toBeUndefined();
    });
  });

  describe("extractLines", () => {
    it("should extract lines from text", () => {
      const text = "line1\nline2\nline3\nline4";
      const lines = extractLines(text, 6, 17);
      expect(lines).toEqual(["line2", "line3"]);
    });

    it("should handle empty range", () => {
      const lines = extractLines("hello\nworld", 5, 5);
      expect(lines).toEqual([""]);
    });

    it("should handle single line", () => {
      const lines = extractLines("hello world", 0, 5);
      expect(lines).toEqual(["hello"]);
    });
  });

  describe("isWhitespace", () => {
    it("should identify whitespace characters", () => {
      expect(isWhitespace(" ")).toBe(true);
      expect(isWhitespace("\t")).toBe(true);
      expect(isWhitespace("\n")).toBe(true);
      expect(isWhitespace("\r")).toBe(true);
    });

    it("should identify non-whitespace characters", () => {
      expect(isWhitespace("a")).toBe(false);
      expect(isWhitespace("0")).toBe(false);
      expect(isWhitespace("!")).toBe(false);
    });
  });

  describe("countLeadingWhitespace", () => {
    it("should count leading spaces", () => {
      expect(countLeadingWhitespace("  hello")).toBe(2);
      expect(countLeadingWhitespace("    world")).toBe(4);
    });

    it("should count leading tabs", () => {
      expect(countLeadingWhitespace("\t\thello")).toBe(2);
    });

    it("should count mixed whitespace", () => {
      expect(countLeadingWhitespace(" \t hello")).toBe(3);
    });

    it("should return 0 for no leading whitespace", () => {
      expect(countLeadingWhitespace("hello")).toBe(0);
    });

    it("should handle all whitespace", () => {
      expect(countLeadingWhitespace("    ")).toBe(4);
    });
  });

  describe("dedentLines", () => {
    it("should remove common leading whitespace", () => {
      const lines = ["  line1", "    line2", "  line3"];
      const result = dedentLines(lines);
      expect(result).toEqual(["line1", "  line2", "line3"]);
    });

    it("should preserve empty lines", () => {
      const lines = ["  line1", "", "  line2"];
      const result = dedentLines(lines);
      expect(result).toEqual(["line1", "", "line2"]);
    });

    it("should handle no common indent", () => {
      const lines = ["line1", "  line2"];
      const result = dedentLines(lines);
      expect(result).toEqual(["line1", "  line2"]);
    });

    it("should handle all empty lines", () => {
      const lines = ["", "", ""];
      const result = dedentLines(lines);
      expect(result).toEqual(["", "", ""]);
    });
  });

  describe("escapeRegex", () => {
    it("should escape special regex characters", () => {
      expect(escapeRegex("hello.world")).toBe("hello\\.world");
      expect(escapeRegex("[abc]")).toBe("\\[abc\\]");
      expect(escapeRegex("a+b*c?")).toBe("a\\+b\\*c\\?");
      expect(escapeRegex("^start$")).toBe("\\^start\\$");
      expect(escapeRegex("(group)")).toBe("\\(group\\)");
      expect(escapeRegex("a|b")).toBe("a\\|b");
      expect(escapeRegex("\\backslash")).toBe("\\\\backslash");
    });

    it("should not escape normal characters", () => {
      expect(escapeRegex("hello world")).toBe("hello world");
    });
  });

  describe("createEndMarkerRegex", () => {
    it("should create regex for end marker", () => {
      const regex = createEndMarkerRegex("```");
      expect(regex.test("```")).toBe(true);
      expect(regex.test("``` ")).toBe(true);
      expect(regex.test("```\t")).toBe(true);
      expect(regex.test(" ```")).toBe(false);
    });

    it("should handle special characters in marker", () => {
      const regex = createEndMarkerRegex("***");
      expect(regex.test("***")).toBe(true);
      expect(regex.test("***   ")).toBe(true);
    });
  });

  describe("normalizeLineEndings", () => {
    it("should convert CRLF to LF", () => {
      expect(normalizeLineEndings("hello\r\nworld")).toBe("hello\nworld");
    });

    it("should convert CR to LF", () => {
      expect(normalizeLineEndings("hello\rworld")).toBe("hello\nworld");
    });

    it("should preserve existing LF", () => {
      expect(normalizeLineEndings("hello\nworld")).toBe("hello\nworld");
    });

    it("should handle mixed line endings", () => {
      expect(normalizeLineEndings("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
    });
  });

  describe("startsWithAt", () => {
    it("should check if text starts with pattern at index", () => {
      expect(startsWithAt("hello world", "world", 6)).toBe(true);
      expect(startsWithAt("hello world", "hello", 0)).toBe(true);
      expect(startsWithAt("hello world", "world", 0)).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(startsWithAt("hello", "hello world", 0)).toBe(false);
      expect(startsWithAt("", "hello", 0)).toBe(false);
      expect(startsWithAt("hello", "", 0)).toBe(true);
    });
  });

  describe("parseCodeBlockMetadata", () => {
    it("should parse language only", () => {
      const metadata = parseCodeBlockMetadata("typescript");
      expect(metadata).toEqual({ language: "typescript" });
    });

    it("should parse language with metadata", () => {
      const metadata = parseCodeBlockMetadata("typescript title=example.ts");
      expect(metadata).toEqual({
        language: "typescript",
        title: "example.ts",
      });
    });

    it("should parse multiple metadata pairs", () => {
      const metadata = parseCodeBlockMetadata("python title=main.py lines=10-20");
      expect(metadata).toEqual({
        language: "python",
        title: "main.py",
        lines: "10-20",
      });
    });

    it("should handle empty input", () => {
      const metadata = parseCodeBlockMetadata("");
      expect(metadata).toEqual({});
    });

    it("should ignore invalid metadata", () => {
      const metadata = parseCodeBlockMetadata("javascript invalid title=valid");
      expect(metadata).toEqual({
        language: "javascript",
        title: "valid",
      });
    });
  });
});
