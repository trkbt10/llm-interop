/**
 * @file Deterministic byte derivation using Murmur3 as a fast PRF.
 * Not cryptographically secure. Designed for speed and stable, reproducible
 * outputs to generate compact identifiers of a requested length.
 */
/* eslint-disable no-restricted-syntax -- Intentional use of mutable counters for tight loops. */
import { murmur3_x86_128 } from "./murmur3.js";

/**
 * Generate a deterministic sequence of bytes of arbitrary length.
 * Uses MurmurHash3 x86_128 repeatedly with a counter-mixed seed and
 * concatenates 16-byte blocks until the requested length is filled.
 * Fast and non-cryptographic; intended for compact, reproducible IDs.
 */
export function derive(key: Uint8Array, outLen: number, seed: number): Uint8Array {
  const out = new Uint8Array(outLen);
  let off = 0;
  let ctr = 0;
  while (off < outLen) {
    // Derive 128-bit blocks and concatenate until we reach the target length.
    const blockSeed = (seed ^ (ctr * 0x9e3779b1)) >>> 0;
    const block = murmur3_x86_128(key, blockSeed);
    const n = Math.min(16, outLen - off);
    out.set(block.subarray(0, n), off);
    off += n;
    ctr++;
  }
  return out;
}
