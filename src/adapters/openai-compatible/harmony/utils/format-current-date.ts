/**
 * @file Format current date for Harmony system message.
 */

/**
 * Generates current date string in YYYY-MM-DD format for system context.
 * Provides LLMs with accurate temporal context for date-aware responses,
 * enabling proper handling of time-sensitive queries and ensuring responses
 * reflect current date information when needed for context.
 *
 * @returns Current date formatted as YYYY-MM-DD string
 */
export function formatCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
