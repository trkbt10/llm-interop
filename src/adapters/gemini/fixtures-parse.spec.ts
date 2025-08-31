/**
 * @file Integration test: copy all files under __mocks__/raw/gemini-direct into __fixtures__/gemini-direct
 * without overwriting, and validate that parsers can read them.
 */
import { mkdirSync, existsSync, copyFileSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonlToArray } from "../../utils/jsonl/reader";
import { parseNonSseLogFile, concatCandidateTexts } from "../gemini/non-sse-parser";

const RAW_DIR = "__mocks__/raw/gemini-direct";
const FIXTURES_DIR = "__fixtures__/gemini-direct";

function copyAllRawFiles(): string[] {
  if (!existsSync(RAW_DIR)) {
    return [];
  }
  const files = readdirSync(RAW_DIR).filter((f) => /\.(jsonl|log|txt)$/.test(f));
  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  const copied: string[] = [];
  for (const f of files) {
    const src = join(RAW_DIR, f);
    const dst = join(FIXTURES_DIR, f);
    if (!existsSync(dst)) {
      copyFileSync(src, dst);
    }
    copied.push(dst);
  }
  return copied;
}

describe("Gemini fixtures parsing (all files)", () => {
  it("copies all mocks to fixtures and parses by type", async () => {
    const copied = copyAllRawFiles();
    if (copied.length === 0) {
      console.warn("⏭️  No files under __mocks__/raw/gemini-direct; skipping");
      return;
    }
    for (const p of copied) {
      const size = statSync(p).size;
      expect(size).toBeGreaterThan(0);
      if (p.endsWith(".jsonl")) {
        const events = await readJsonlToArray<Record<string, unknown>>(p);
        expect(Array.isArray(events)).toBe(true);
        expect(events.length).toBeGreaterThan(0);
        // Each line should be an object
        for (const ev of events) {
          expect(typeof ev).toBe("object");
          expect(ev).not.toBeNull();
        }
      } else if (p.endsWith(".log")) {
        const res = await parseNonSseLogFile(p);
        if (res.mode === "text") {
          // At minimum, there should be some non-empty content
          expect(res.lines.some((l) => l.trim().length > 0)).toBe(true);
        } else {
          expect(res.chunks.length).toBeGreaterThan(0);
          // Best-effort text stitch
          const stitched = concatCandidateTexts(res.chunks);
          expect(typeof stitched).toBe("string");
        }
      } else if (p.endsWith(".txt")) {
        const body = readFileSync(p, "utf8");
        expect(typeof body).toBe("string");
        expect(body.length).toBeGreaterThan(0);
        // Try JSON parse when looks like JSON, but don't fail if not
        const first = body.trimStart()[0];
        const looksJson = first === "{" || first === "[";
        if (looksJson) {
          try {
            const parsed = JSON.parse(body);
            expect(typeof parsed).toBe("object");
          } catch {
            // acceptable: treat as text
          }
        }
      }
    }
  });
});
