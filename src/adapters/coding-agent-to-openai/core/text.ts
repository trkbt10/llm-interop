/**
 * @file Text helpers specific to coding-agent adapter
 */

/**
 * Remove a single triple backtick code fence wrapping, preserving inner text.
 * If not fenced, returns the input unchanged.
 */
export function stripCodeFence(text: string): string {
  const fence = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)```\s*$/m;
  const trimmed = text.trim();
  const m = trimmed.match(fence);
  if (!m) {
    return text;
  }
  const inner0 = m[1];
  return inner0.endsWith("\n") ? inner0.slice(0, -1) : inner0;
}

