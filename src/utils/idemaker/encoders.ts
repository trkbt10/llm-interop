/**
 * @file Byte-to-string encoders for stable ID rendering.
 * The encoders return URL- and filename-friendly strings which are concise
 * yet deterministic, suitable for IDs. Mutable loops are used for speed.
 */
/* eslint-disable no-restricted-syntax -- Performance-oriented tight loops require mutable counters/accumulators. */

/**
 * Convert bytes to lowercase hex string.
 * Why: Hex is a human-friendly, portable representation; faster than crypto
 * for small buffers and has predictable, fixed width.
 */
export function toHex(bytes: Uint8Array): string {
  const lut = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += lut[bytes[i]];
  }
  return s;
}

/**
 * Encode bytes as Base64URL without padding.
 * Why: URL-safe, short identifiers for 16-byte inputs (22 chars) that avoid
 * `=` padding and are safe as path segments.
 */
export function toBase64Url(bytes: Uint8Array): string {
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += table[(n >>> 18) & 63] + table[(n >>> 12) & 63] + table[(n >>> 6) & 63] + table[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += table[(n >>> 18) & 63] + table[(n >>> 12) & 63];
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += table[(n >>> 18) & 63] + table[(n >>> 12) & 63] + table[(n >>> 6) & 63];
  }
  return out; // no padding for Base64URL
}
