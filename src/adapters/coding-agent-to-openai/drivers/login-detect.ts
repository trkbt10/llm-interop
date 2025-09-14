/**
 * @file Detect CLI login/authentication prompts in process outputs
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
  let score = 0;
  for (const n of needles) {
    if (s.includes(n)) {
      score += 1;
    }
  }
  // Heuristic: at least 2 signals to reduce false positives
  return score >= 2;
}

export function extractErrorText(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as { stdout?: unknown; stderr?: unknown; message?: unknown };
    const parts: string[] = [];
    if (typeof anyErr.stderr === "string") parts.push(anyErr.stderr);
    if (typeof anyErr.stdout === "string") parts.push(anyErr.stdout);
    if (typeof anyErr.message === "string") parts.push(anyErr.message);
    return parts.join("\n");
  }
  return String(err);
}

export function assertNoLoginPromptOrThrow(stdout: string, stderr?: string): void {
  const combined = [stdout, stderr ?? ""].filter(Boolean).join("\n");
  if (isLoginRequired(combined)) {
    const msg =
      "Coding agent CLI requires login. Please authenticate with your CLI (e.g., `<cli> login`) and retry.";
    throw new Error(msg);
  }
}
