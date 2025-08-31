/**
 * @file Tests for MurmurHash3 x86_128 port.
 * Verifies determinism and seed variation without asserting fixed vectors.
 */
import { murmur3_x86_128 } from "./murmur3.js";

function hex(u8: Uint8Array): string {
  return Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("murmur3_x86_128", () => {
  it("produces 16 bytes and is deterministic", () => {
    const input = new TextEncoder().encode("hello world");
    const h1 = murmur3_x86_128(input, 0);
    const h2 = murmur3_x86_128(input, 0);
    expect(h1).toBeInstanceOf(Uint8Array);
    expect(h1.length).toBe(16);
    expect(hex(h1)).toBe(hex(h2));
  });

  it("changes with seed", () => {
    const input = new TextEncoder().encode("hello world");
    const h1 = hex(murmur3_x86_128(input, 0));
    const h2 = hex(murmur3_x86_128(input, 123));
    expect(h1).not.toBe(h2);
  });

  it("covers all tail switch branches (1..15)", () => {
    for (let len = 1; len <= 15; len++) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = i & 0xff;
      }
      const out = murmur3_x86_128(bytes, 0xdeadbeef);
      expect(out.length).toBe(16);
    }
  });

  it("covers body loop with >=16 and multi-block (>=32) inputs", () => {
    const arr16 = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      arr16[i] = (i * 7) & 0xff;
    }
    const arr32 = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      arr32[i] = (i * 13) & 0xff;
    }
    const h16 = hex(murmur3_x86_128(arr16, 1));
    const h32 = hex(murmur3_x86_128(arr32, 1));
    expect(h16).toHaveLength(32);
    expect(h32).toHaveLength(32);
    expect(h16).not.toBe(h32);
  });
});
