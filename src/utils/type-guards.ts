/**
 * @file Common type guard utilities
 */

/**
 * Type guard to check if a value is a non-null object
 */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
