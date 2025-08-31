/**
 * @file MurmurHash3 x86_128 (public domain) translated to TypeScript.
 * Purpose: Provide a fast, non-cryptographic 128-bit hash for deterministic
 * ID derivation. This implementation mirrors the reference algorithm and uses
 * explicit 32-bit math and mutation for performance and fidelity.
 */
/* eslint-disable no-restricted-syntax -- Faithful port requires mutable variables and counters for performance. */
/* eslint-disable jsdoc/require-jsdoc -- Local helpers are self-descriptive within the hashing context. */
/* MurmurHash3 x86_128 (Public Domain, Austin Appleby) port in TS: 32-bit ops only. */
export function murmur3_x86_128(key: Uint8Array, seed = 0): Uint8Array {
  const c1 = 0x239b961b | 0;
  const c2 = 0xab0e9789 | 0;
  const c3 = 0x38b34ae5 | 0;
  const c4 = 0xa1e38b93 | 0;

  let h1 = seed | 0;
  let h2 = seed | 0;
  let h3 = seed | 0;
  let h4 = seed | 0;

  const len = key.length;
  const nblocks = (len / 16) | 0;

  // body
  for (let i = 0; i < nblocks; i++) {
    const p = i * 16;
    let k1 = readU32LE(key, p + 0);
    let k2 = readU32LE(key, p + 4);
    let k3 = readU32LE(key, p + 8);
    let k4 = readU32LE(key, p + 12);

    k1 = Math.imul(k1, c1);
    k1 = rotl32(k1, 15);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = rotl32(h1, 19);
    h1 = (h1 + h2) | 0;
    h1 = (Math.imul(h1, 5) + 0x561ccd1b) | 0;

    k2 = Math.imul(k2, c2);
    k2 = rotl32(k2, 16);
    k2 = Math.imul(k2, c3);
    h2 ^= k2;
    h2 = rotl32(h2, 17);
    h2 = (h2 + h3) | 0;
    h2 = (Math.imul(h2, 5) + 0x0bcaa747) | 0;

    k3 = Math.imul(k3, c3);
    k3 = rotl32(k3, 17);
    k3 = Math.imul(k3, c4);
    h3 ^= k3;
    h3 = rotl32(h3, 15);
    h3 = (h3 + h4) | 0;
    h3 = (Math.imul(h3, 5) + 0x96cd1c35) | 0;

    k4 = Math.imul(k4, c4);
    k4 = rotl32(k4, 18);
    k4 = Math.imul(k4, c1);
    h4 ^= k4;
    h4 = rotl32(h4, 13);
    h4 = (h4 + h1) | 0;
    h4 = (Math.imul(h4, 5) + 0x32ac3b17) | 0;
  }

  // tail
  let k1 = 0,
    k2 = 0,
    k3 = 0,
    k4 = 0;
  const tail = len & 15;
  const tp = nblocks * 16;

  switch (tail) {
    case 15:
      k4 ^= key[tp + 14] << 16;
    // falls through
    case 14:
      k4 ^= key[tp + 13] << 8;
    // falls through
    case 13:
      k4 ^= key[tp + 12];
      k4 = Math.imul(k4, c4);
      k4 = rotl32(k4, 18);
      k4 = Math.imul(k4, c1);
      h4 ^= k4;
    // falls through
    case 12:
      k3 ^= key[tp + 11] << 24;
    // falls through
    case 11:
      k3 ^= key[tp + 10] << 16;
    // falls through
    case 10:
      k3 ^= key[tp + 9] << 8;
    // falls through
    case 9:
      k3 ^= key[tp + 8];
      k3 = Math.imul(k3, c3);
      k3 = rotl32(k3, 17);
      k3 = Math.imul(k3, c4);
      h3 ^= k3;
    // falls through
    case 8:
      k2 ^= key[tp + 7] << 24;
    // falls through
    case 7:
      k2 ^= key[tp + 6] << 16;
    // falls through
    case 6:
      k2 ^= key[tp + 5] << 8;
    // falls through
    case 5:
      k2 ^= key[tp + 4];
      k2 = Math.imul(k2, c2);
      k2 = rotl32(k2, 16);
      k2 = Math.imul(k2, c3);
      h2 ^= k2;
    // falls through
    case 4:
      k1 ^= key[tp + 3] << 24;
    // falls through
    case 3:
      k1 ^= key[tp + 2] << 16;
    // falls through
    case 2:
      k1 ^= key[tp + 1] << 8;
    // falls through
    case 1:
      k1 ^= key[tp + 0];
      k1 = Math.imul(k1, c1);
      k1 = rotl32(k1, 15);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  // finalization
  h1 ^= len;
  h2 ^= len;
  h3 ^= len;
  h4 ^= len;
  h1 = (h1 + h2 + h3 + h4) | 0;
  h2 = (h2 + h1) | 0;
  h3 = (h3 + h1) | 0;
  h4 = (h4 + h1) | 0;

  h1 = fmix32(h1);
  h2 = fmix32(h2);
  h3 = fmix32(h3);
  h4 = fmix32(h4);

  h1 = (h1 + h2 + h3 + h4) | 0;
  h2 = (h2 + h1) | 0;
  h3 = (h3 + h1) | 0;
  h4 = (h4 + h1) | 0;

  const out = new Uint8Array(16);
  writeU32LE(out, 0, h1 >>> 0);
  writeU32LE(out, 4, h2 >>> 0);
  writeU32LE(out, 8, h3 >>> 0);
  writeU32LE(out, 12, h4 >>> 0);
  return out;
}

function readU32LE(b: Uint8Array, i: number): number {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}
function writeU32LE(out: Uint8Array, i: number, v: number) {
  out[i] = v & 0xff;
  out[i + 1] = (v >>> 8) & 0xff;
  out[i + 2] = (v >>> 16) & 0xff;
  out[i + 3] = (v >>> 24) & 0xff;
}
function rotl32(x: number, r: number): number {
  return (x << r) | (x >>> (32 - r));
}
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h | 0;
}
