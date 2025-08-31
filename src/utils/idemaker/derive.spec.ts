/**
 * @file Tests for deterministic byte derivation.
 * Verifies fixed length output and reproducibility given same inputs.
 */
import { derive } from "./derive.js";

describe("derive", () => {
  it("generates requested length deterministically", () => {
    const key = new TextEncoder().encode("key");
    const a = derive(key, 32, 0x12345678);
    const b = derive(key, 32, 0x12345678);
    expect(a.length).toBe(32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
