/**
 * @file Stream utilities
 */

/** Stream utilities */
export function isReadableStream(v: unknown): v is ReadableStream {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  return typeof (v as { getReader?: unknown }).getReader === "function";
}
