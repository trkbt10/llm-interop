/**
 * @file Utilities for composing and running multiple async attempts with controlled fallback.
 */

/**
 * Normalize any thrown value into an Error without losing information.
 */
export const normalizeError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

/**
 * Run a composed set of attempts in order. If an attempt fails:
 * - when autoFallback is false, immediately throw the original error (no masking)
 * - when autoFallback is true, continue to the next attempt; if all fail, throw AggregateError of all errors
 */
export async function runComposedAttempts<T>(
  attempts: Array<() => Promise<T>>,
  options: { autoFallback: boolean },
): Promise<T> {
  const { autoFallback } = options;
  const errors: Error[] = [];
  for (let i = 0; i < attempts.length; i += 1) {
    try {
      return await attempts[i]!();
    } catch (err) {
      const normalized = normalizeError(err);
      errors.push(normalized);
      const isLast = i === attempts.length - 1;
      if (!autoFallback || isLast) {
        if (errors.length > 1) {
          throw new AggregateError(errors, "All composed attempts failed");
        }
        throw normalized;
      }
    }
  }
  throw new Error("No attempts were provided");
}

