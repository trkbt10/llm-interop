/**
 * @file Tests for byte helpers in idemaker.
 * Focus: UTF-8 encoding, salt normalization, and concatenation correctness.
 */
import { concatBytes, normalizeSalt, textToBytes } from "./bytes.js";

describe("bytes", () => {
  it("textToBytes encodes UTF-8", () => {
    expect(Array.from(textToBytes("foo"))).toEqual([102, 111, 111]);
  });

  it("normalizeSalt handles string and bytes", () => {
    const s = "ab";
    const ns = normalizeSalt(s);
    expect(ns).toBeInstanceOf(Uint8Array);
    expect(ns.length).toBe(2);
    const b = new Uint8Array([1, 2, 3]);
    expect(normalizeSalt(b)).toBe(b);
  });

  it("concatBytes concatenates correctly", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3]);
    const out = concatBytes(a, b);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
});
