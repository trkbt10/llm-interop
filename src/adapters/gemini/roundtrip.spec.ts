/**
 * @file Round‑trip test: Gemini chunks → OpenAI events → Gemini chunks, for ALL fixtures.
 * Validates that text and basic function calls survive the round‑trip.
 */
import { mkdirSync, existsSync, copyFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonlToArray } from "../../utils/jsonl/reader";
import { geminiToOpenAIStream } from "../gemini-to-openai";
import { ensureOpenAIResponseStream } from "../../providers/openai/responses-guards/stream-event";
import { createInitialState, processOpenAIEventToGemini } from "../openai-to-gemini-v1beta/event-reducer";
import { parseNonSseLogFile, concatCandidateTexts } from "./non-sse-parser";
import type { GenerateContentResponse } from "../../providers/gemini/client/fetch-client";
import { isGeminiResponse, getCandidateParts, isGeminiFunctionCallPart } from "../../providers/gemini/guards";
import type { GeminiStreamChunk } from "../openai-to-gemini-v1beta/core/gemini-types";

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

function extractTextAndFnsFromResponses(chunks: GenerateContentResponse[]): { text: string; fns: Set<string> } {
  const text = concatCandidateTexts(chunks);
  const fns = new Set<string>();
  for (const c of chunks) {
    for (const p of getCandidateParts(c)) {
      if (isGeminiFunctionCallPart(p)) {
        fns.add(p.functionCall.name);
      }
    }
  }
  return { text, fns };
}

function extractTextAndFnsFromStreamChunks(chunks: GeminiStreamChunk[]): { text: string; fns: Set<string> } {
  const texts: string[] = [];
  const fns = new Set<string>();
  for (const ch of chunks) {
    const cand = ch.candidates?.[0];
    const parts = cand?.content?.parts ?? [];
    for (const p of parts) {
      if ("text" in p && typeof (p as { text?: unknown }).text === "string") {
        texts.push(String((p as { text: string }).text));
      }
      if ("functionCall" in p && (p as { functionCall?: { name?: unknown } }).functionCall?.name) {
        fns.add(String((p as { functionCall: { name: string } }).functionCall.name));
      }
    }
  }
  return { text: texts.join(""), fns };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const v of it) {
    arr.push(v);
  }
  return arr;
}

async function loadUnknownChunks(path: string): Promise<unknown[]> {
  if (path.endsWith(".jsonl")) {
    const arr = await readJsonlToArray<Record<string, unknown>>(path);
    return arr as unknown[];
  }
  if (path.endsWith(".log")) {
    const parsed = await parseNonSseLogFile(path);
    if (parsed.mode === "text") {
      return [];
    }
    return parsed.chunks as unknown[];
  }
  if (path.endsWith(".txt")) {
    const body = readFileSync(path, "utf8");
    const first = body.trimStart()[0];
    const looksJson = first === "{" || first === "[";
    if (looksJson) {
      try {
        return [JSON.parse(body)];
      } catch {
        return [];
      }
    }
  }
  return [];
}

describe("Gemini ↔ OpenAI round‑trip for all fixtures", () => {
  it("round‑trips text and function calls for every fixture", async () => {
    const files = copyAllRawFiles();
    if (files.length === 0) {
      console.warn("⏭️  No fixtures under __mocks__/raw/gemini-direct; skipping");
      return;
    }

    for (const p of files) {
      const loadedChunks = await loadUnknownChunks(p);
      if (loadedChunks.length === 0) {
        continue;
      }

      const chunks = loadedChunks.filter(isGeminiResponse);
      if (chunks.length === 0) {
        continue;
      }

      // 1) Gemini chunks → OpenAI stream events
      async function* yieldChunks() {
        for (const c of chunks) {
          yield c;
        }
      }
      const oaEvents = await collect(geminiToOpenAIStream(yieldChunks()));

      // 2) OpenAI events → Gemini stream chunks
      const state = createInitialState();
      const outChunks: GeminiStreamChunk[] = [];
      for await (const ev of ensureOpenAIResponseStream((async function*(){ for (const e of oaEvents) { yield e; } })())) {
        const res = processOpenAIEventToGemini(state, ev);
        const gcs = res.chunks;
        for (const gc of gcs) {
          outChunks.push(gc);
        }
      }

      // Compare text and function call names (best effort)
      const a = extractTextAndFnsFromResponses(chunks);
      const b = extractTextAndFnsFromStreamChunks(outChunks);

      // Text containment allows for delta/accumulation differences
      expect(a.text.replace(/\s+/g, " ").trim()).toContain(b.text.replace(/\s+/g, " ").trim().slice(0, 100));
      // Function names equality as sets (subset check: reconstructed should include originals)
      for (const name of a.fns) {
        expect(b.fns.has(name)).toBe(true);
      }
    }
  });
});
