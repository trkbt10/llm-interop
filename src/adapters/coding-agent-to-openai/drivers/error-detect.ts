/**
 * @file Heuristics to detect CLI errors from stdout/stderr blobs
 */

type KnownErrorShape = {
  error?: {
    code?: number | string;
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
};

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractError(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }
  const o = obj as KnownErrorShape;
  if (o.error) {
    const parts: string[] = [];
    if (o.error.status) {
      parts.push(String(o.error.status));
    }
    if (o.error.code != null) {
      parts.push(String(o.error.code));
    }
    if (o.error.message) {
      parts.push(o.error.message);
    }
    if (o.error.errors && o.error.errors.length) {
      parts.push(o.error.errors.map((e) => e.message ?? e.reason ?? "").join("; "));
    }
    const msg = parts.filter(Boolean).join(" | ");
    return msg.length > 0 ? msg : "Unknown CLI error";
  }
  return undefined;
}

/**
 * Inspect stdout/stderr for structured or heuristic error signals and throw with a concise message.
 * - Parses JSON and JSON arrays for { error: { ... } } shapes and composes a readable summary.
 * - Falls back to keyword heuristics for common API errors (e.g., not_found) to reduce silent failures.
 */
export function assertNoCliErrorOutput(stdout: string, stderr?: string): void {
  const blobs = [stdout, stderr ?? ""]; // order matters
  for (const b of blobs) {
    const text = (b ?? "").trim();
    if (!text) {
      continue;
    }
    // Try exact JSON
    const parsed = tryParseJson(text);
    if (parsed) {
      const err = extractError(parsed);
      if (err) {
        throw new Error(err);
      }
    }
    // Try JSON array first element
    if (text.startsWith("[") && text.endsWith("]")) {
      const arr = tryParseJson(text) as unknown[] | undefined;
      if (Array.isArray(arr) && arr.length > 0) {
        const err = extractError(arr[0]);
        if (err) {
          throw new Error(err);
        }
      }
    }
    // Heuristic keywords
    const lowered = text.toLowerCase();
    const hints = ["error:", '"error"', "not_found", "not found", "failed", "exception"];
    if (hints.some((h) => lowered.includes(h))) {
      // Avoid false positive on normal output: only throw if looks serious
      if (lowered.includes("requested entity was not found") || lowered.includes("status\":\"not_found\"")) {
        throw new Error(text);
      }
    }
  }
}
