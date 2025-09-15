/**
 * @file Detect CLI login/authentication prompts in process outputs
 */

/**
 * Heuristically detect whether CLI output likely requests authentication.
 * Requires at least two distinct signals (e.g., "please login" + "unauthorized") to avoid false positives.
 */
export function isLoginRequired(output: string): boolean {
  const needles = [
    "please login",
    "please log in",
    "run",
    "login",
    "authenticate",
    "sign in",
    "not logged in",
    "no credentials",
    "unauthorized",
    "forbidden",
    "401",
  ];
  const s = output.toLowerCase();
  const score = needles.reduce((acc, n) => acc + (s.includes(n) ? 1 : 0), 0);
  // Heuristic: at least 2 signals to reduce false positives
  return score >= 2;
}

/**
 * Extract a readable error string from a thrown value produced by child_process APIs.
 * Concatenates stderr/stdout/message fields when present; otherwise stringifies the value.
 */
export function extractErrorText(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as { stdout?: unknown; stderr?: unknown; message?: unknown };
    const parts: string[] = [];
    if (typeof anyErr.stderr === "string") {
      parts.push(anyErr.stderr);
    }
    if (typeof anyErr.stdout === "string") {
      parts.push(anyErr.stdout);
    }
    if (typeof anyErr.message === "string") {
      parts.push(anyErr.message);
    }
    return parts.join("\n");
  }
  return String(err);
}

/**
 * Throw an explicit error if combined stdout/stderr suggests a login flow is required.
 * This helps surface actionable guidance upstream instead of failing silently.
 */
export function assertNoLoginPromptOrThrow(stdout: string, stderr?: string): void {
  const combined = [stdout, stderr ?? ""].filter(Boolean).join("\n");
  if (isLoginRequired(combined)) {
    const msg =
      "Coding agent CLI requires login. Please authenticate with your CLI (e.g., `<cli> login`) and retry.";
    throw new Error(msg);
  }
}
