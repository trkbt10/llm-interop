/**
 * @file File tailing utility used by CLI drivers
 * Streams appended content until the file stays idle for a short period.
 */
import { promises as fsp } from "node:fs";

export type TailOptions = { pollMs?: number; idleMs?: number };

/**
 * Stream chunks appended to a file, polling until idle.
 * - Starts reading from the current end (does not emit existing content).
 * - Yields new slices as they are written; completes after idleMs of no growth once any data has been seen.
 */
export async function* tailFile(
  path: string,
  opts: TailOptions = {},
): AsyncGenerator<string, void, unknown> {
  const pollMs = opts.pollMs ?? 80;
  const idleMs = opts.idleMs ?? 500;
  const state = { off: 0, lastGrowAt: Date.now(), seenAny: false } as {
    off: number;
    lastGrowAt: number;
    seenAny: boolean;
  };
  for (;;) {
    const size = await safeSize(path);
    if (size > state.off) {
      const content = await fsp.readFile(path, { encoding: "utf8" as BufferEncoding });
      const slice = content.slice(state.off);
      state.off = size;
      state.lastGrowAt = Date.now();
      state.seenAny = true;
      if (slice) {
        yield slice;
        continue;
      }
    }
    if (state.seenAny && Date.now() - state.lastGrowAt >= idleMs) {
      return;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

async function safeSize(path: string): Promise<number> {
  try {
    const st = await fsp.stat(path);
    return st.size;
  } catch {
    return 0;
  }
}
