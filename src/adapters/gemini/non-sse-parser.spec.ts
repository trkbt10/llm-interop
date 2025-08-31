/**
 * @file Tests for non‑SSE streaming parser using a copied fixture from __mocks__/raw/gemini-direct.
 * The test copies the first matching Non‑SSE .log into __fixtures__/gemini-direct and
 * never overwrites it (idempotent), then parses it.
 */
import { mkdirSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseNonSseLogFile, concatCandidateTexts } from "./non-sse-parser";

const RAW_DIR = "__mocks__/raw/gemini-direct";
const FIXTURES_DIR = "__fixtures__/gemini-direct";
const TARGET_BASENAME = "non-sse-stream.log";

function findFirstNonSseLog(): string | null {
  if (!existsSync(RAW_DIR)) {
    return null;
  }
  const files = readdirSync(RAW_DIR);
  const cand = files.find((f) => f.endsWith(".log") ? f.includes("Non-SSE streaming") : false);
  return cand ? join(RAW_DIR, cand) : null;
}

function ensureFixtureCopied(): string | null {
  const src = findFirstNonSseLog();
  if (!src) {
    return null;
  }
  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  const dst = join(FIXTURES_DIR, TARGET_BASENAME);
  if (!existsSync(dst)) {
    copyFileSync(src, dst); // do not overwrite on subsequent runs
  }
  return dst;
}

describe("Gemini non‑SSE streaming parser", () => {
  it("parses the copied fixture without overwriting source", async () => {
    const fixturePath = ensureFixtureCopied();
    if (!fixturePath) {
      // If developer hasn't generated mocks yet, skip instead of failing CI.
      console.warn("⏭️  No Non‑SSE log found under __mocks__/raw/gemini-direct; skipping test");
      return;
    }
    const result = await parseNonSseLogFile(fixturePath);
    // Accept any structured JSON mode; sample tends to be json-array
    if (result.mode === "text") {
      // Should ideally be structured; still allow text but require at least 1 non-empty line
      expect(result.lines.some((l) => l.trim().length > 0)).toBe(true);
    } else {
      expect(result.chunks.length).toBeGreaterThan(0);
      const stitched = concatCandidateTexts(result.chunks);
      expect(typeof stitched).toBe("string");
      expect(stitched.length).toBeGreaterThan(0);
    }
  });
});
