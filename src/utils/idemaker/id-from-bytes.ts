/**
 * @file Core ID generator from byte input.
 * Why: Centralizes mode-specific rendering (uuid-like, base64url, hex) and
 * applies namespacing via salt and deterministic byte derivation.
 */
import type { IdMode, IdOptions } from "./types.js";
import { concatBytes, normalizeSalt } from "./bytes.js";
import { derive } from "./derive.js";
import { toBase64Url, toHex } from "./encoders.js";

/**
 * Generate a deterministic ID from existing bytes.
 * - uuid4: 16 bytes formatted as RFC 4122-looking UUID v4 (sets version/variant bits)
 * - base64: 16 bytes rendered as Base64URL without padding (22 chars)
 * - sha256: 32 bytes hex string (visual-compatible with SHA-256; not cryptographic)
 * Salt is prepended to segregate namespaces for identical inputs.
 */
export function idFromBytes(bytes: Uint8Array, mode: IdMode, opts: IdOptions = {}): string {
  const seed = (opts.seed ?? 0x97c29b3d) >>> 0;
  const key = opts.salt ? concatBytes(normalizeSalt(opts.salt), bytes) : bytes;

  if (mode === "uuid4") {
    const b = derive(key, 16, seed);
    // Shape as UUID v4 by setting version/variant bits per RFC 4122
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant RFC 4122
    const hex = toHex(b);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  if (mode === "base64") {
    // 16 bytes → Base64URL (no padding, 22 chars)
    const b = derive(key, 16, seed);
    return toBase64Url(b);
  }

  // SHA-256-like (visual-compatible: 64 hex chars). Uses two concatenated
  // 128-bit Murmur blocks for 256-bit output (performance over cryptographic strength).
  const b = derive(key, 32, seed);
  return toHex(b);
}
