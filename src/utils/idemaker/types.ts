/**
 * @file Types for idemaker configuration.
 * These types keep the public API lightweight and portable across modules.
 */

export type IdMode = "uuid4" | "base64" | "sha256";

export type IdOptions = {
  /** Optional namespace to separate identical inputs into different spaces. */
  salt?: string | Uint8Array;
  /** Murmur3 seed (32-bit). Defaults are sufficient for most cases. */
  seed?: number;
};
