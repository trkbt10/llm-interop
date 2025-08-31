// idemaker entry point: keep idFromText implementation here
/**
 * @file Entry point for idemaker utilities.
 * Exposes the primary `idFromText` API while delegating heavy-lifting to
 * split modules for hashing, encoding, and byte manipulation. Keeping this file
 * lightweight makes the public surface obvious and tree-shakable.
 */
import { textToBytes } from "./bytes.js";
import type { IdMode, IdOptions } from "./types.js";
import { idFromBytes } from "./id-from-bytes.js";

/**
 * Generate a deterministic ID directly from text input.
 * Delegates byte-level work to `idFromBytes` after UTF-8 encoding.
 */
export function idFromText(text: string, mode: IdMode, opts: IdOptions = {}): string {
  return idFromBytes(textToBytes(text), mode, opts);
}

export { textToBytes } from "./bytes.js";
export { idFromBytes } from "./id-from-bytes.js";
export type { IdMode, IdOptions } from "./types.js";
