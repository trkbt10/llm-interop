/**
 * @file Simple file tailer producing appended chunks as an async iterable
 */
import { readFileSync, statSync } from "node:fs";

/**
 * Tail a file by polling its size and yielding newly appended content.
 */
export async function* tailFile(path: string, pollMs = 80): AsyncGenerator<string, void, unknown> {
  const state = { off: 0 } as { off: number };
  for (;;) {
    const size = safeSize(path);
    if (size > state.off) {
      const content = readFileSync(path, { encoding: "utf8" as BufferEncoding });
      const slice = content.slice(state.off);
      state.off = size;
      if (slice) {
        yield slice;
        continue;
      }
    }
    await sleep(pollMs);
  }
}

function safeSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
