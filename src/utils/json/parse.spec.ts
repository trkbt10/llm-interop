/**
 * @file Tests for JSON parsing utilities
 */
import { parseValueLiteral } from "./parse";

describe("parseValueLiteral", () => {
  describe("JSON parsing", () => {
    it("should parse valid JSON objects", () => {
      const result = parseValueLiteral('{"key": "value"}');
      expect(result).toEqual({ key: "value" });
    });

    it("should parse valid JSON arrays", () => {
      const result = parseValueLiteral("[1, 2, 3]");
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse JSON null", () => {
      const result = parseValueLiteral("null");
      expect(result).toBeNull();
    });

    it("should parse JSON strings", () => {
      const result = parseValueLiteral('"hello world"');
      expect(result).toBe("hello world");
    });

    it("should parse JSON numbers", () => {
      const result = parseValueLiteral("42");
      expect(result).toBe(42);
    });

    it("should parse JSON booleans", () => {
      expect(parseValueLiteral("true")).toBe(true);
      expect(parseValueLiteral("false")).toBe(false);
    });
  });

  describe("fallback literal parsing", () => {
    it("should parse boolean literals when JSON parsing fails", () => {
      expect(parseValueLiteral("true")).toBe(true);
      expect(parseValueLiteral("false")).toBe(false);
    });

    it("should parse number literals", () => {
      expect(parseValueLiteral("123")).toBe(123);
      expect(parseValueLiteral("45.67")).toBe(45.67);
      expect(parseValueLiteral("-89")).toBe(-89);
      expect(parseValueLiteral("0")).toBe(0);
    });

    it("should return string for non-parseable values", () => {
      expect(parseValueLiteral("hello")).toBe("hello");
      expect(parseValueLiteral("not-a-number")).toBe("not-a-number");
      expect(parseValueLiteral("")).toBe(0); // Empty string converts to 0
    });

    it("should handle edge cases", () => {
      expect(parseValueLiteral("NaN")).toBe("NaN");
      expect(parseValueLiteral("Infinity")).toBe(Infinity); // Infinity is a number
      expect(parseValueLiteral("-Infinity")).toBe(-Infinity); // -Infinity is a number
    });
  });

  describe("invalid JSON fallback", () => {
    it("should fallback for malformed JSON", () => {
      expect(parseValueLiteral("{invalid json}")).toBe("{invalid json}");
      expect(parseValueLiteral("[1,2,")).toBe("[1,2,");
      expect(parseValueLiteral('{"incomplete":')).toBe('{"incomplete":');
    });
  });
});
