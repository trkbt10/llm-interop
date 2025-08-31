/**
 * @file Type screening against ALL fixtures copied from __mocks__/raw/gemini-direct.
 * Ensures our runtime expectations (Gemini v1beta response-like) match real artifacts.
 */
import { mkdirSync, existsSync, copyFileSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonlToArray } from "../../utils/jsonl/reader";
import { parseNonSseLogFile } from "./non-sse-parser";
import { validateGeminiResponseLike, summarizeIssues } from "./validators";

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
      copyFileSync(src, dst); // do not overwrite
    }
    copied.push(dst);
  }
  return copied;
}

describe("Gemini fixtures type screening (all files)", () => {
  it("validates all JSONL/LOG/TXT fixtures against response-like shape when applicable", async () => {
    const files = copyAllRawFiles();
    if (files.length === 0) {
      console.warn("⏭️  No fixtures under __mocks__/raw/gemini-direct; skipping");
      return;
    }
    const failures: string[] = [];
    for (const p of files) {
      const size = statSync(p).size;
      expect(size).toBeGreaterThan(0);
      if (p.endsWith(".jsonl")) {
        const events = await readJsonlToArray<Record<string, unknown>>(p);
        for (const [idx, ev] of events.entries()) {
          const issues = validateGeminiResponseLike(ev, "$");
          if (issues.length > 0) {
            failures.push(summarizeIssues(p, idx + 1, issues));
          }
        }
      } else if (p.endsWith(".log")) {
        const res = await parseNonSseLogFile(p);
        if (res.mode !== "text") {
          for (const [idx, ch] of res.chunks.entries()) {
            const issues = validateGeminiResponseLike(ch, "$");
            if (issues.length > 0) {
              failures.push(summarizeIssues(p, idx + 1, issues));
            }
          }
        }
      } else if (p.endsWith(".txt")) {
        const shouldValidateAsGen = /generateContent|streamGenerateContent/.test(p);
        if (!shouldValidateAsGen) {
          // e.g., listModels or getModel JSON shapes are not GenerateContentResponse
          continue;
        }
        const body = readFileSync(p, "utf8");
        const first = body.trimStart()[0];
        const looksJson = first === "{" || first === "[";
        if (looksJson) {
          try {
            const obj = JSON.parse(body);
            const issues = validateGeminiResponseLike(obj, "$");
            if (issues.length > 0) {
              failures.push(summarizeIssues(p, null, issues));
            }
          } catch {
            // Non-JSON text is acceptable for .txt
          }
        }
      }
    }
    if (failures.length > 0) {
      const msg = `Type screening found ${failures.length} issue set(s):\n\n` + failures.join("\n\n");
      throw new Error(msg);
    }
  });
});
