import { readFileSync, statSync } from "node:fs";

export type TailOptions = { pollMs?: number; idleMs?: number };

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
    const size = safeSize(path);
    if (size > state.off) {
      const content = readFileSync(path, { encoding: "utf8" as BufferEncoding });
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

function safeSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}
