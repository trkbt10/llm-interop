/**
 * @file Parser for Gemini non‑SSE streaming responses persisted as .log in __mocks__/raw/gemini-direct.
 * Handles several common transports:
 * - Pretty‑printed JSON array of chunk objects
 * - NDJSON (one JSON per line)
 * - Concatenated JSON objects (brace‑balanced)
 * - Fallback to raw text lines
 */
import { readFile } from "node:fs/promises";
import type { GenerateContentResponse } from "../../providers/gemini/client/fetch-client";
import { isGeminiResponse, getCandidateParts, isGeminiTextPart } from "../../providers/gemini/guards";

export type NonSseParseResult =
  | { mode: "json-array" | "ndjson" | "json-chunks"; chunks: GenerateContentResponse[] }
  | { mode: "text"; lines: string[] };

const tryParse = (s: string): unknown | undefined => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

/**
 * Parse non‑SSE streaming body text into chunk objects when possible.
 */
export function parseNonSseBody(body: string): NonSseParseResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { mode: "text", lines: [] };
  }

  // 1) JSON array of chunk objects
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const arr = tryParse(trimmed);
    if (Array.isArray(arr)) {
      const chunks = arr.filter(isGeminiResponse) as GenerateContentResponse[];
      if (chunks.length > 0) {
        return { mode: "json-array", chunks };
      }
    }
  }

  // 2) NDJSON (one JSON per non-empty line)
  const lines = body.split("\n");
  const ndjsonCandidates = lines
    .map((ln) => ln.trim())
    .filter((t) => t !== "" && t !== ",");
  const ndParsed = ndjsonCandidates.map((t) => tryParse(t));
  const ndAllValid = ndParsed.every((obj) => isGeminiResponse(obj));
  if (ndAllValid && ndParsed.length > 0) {
    const nd = ndParsed.filter(isGeminiResponse) as GenerateContentResponse[];
    return { mode: "ndjson", chunks: nd };
  }

  // 3) Brace‑balanced concatenated JSON objects (possibly with commas/whitespace in between)
  const chunks: GenerateContentResponse[] = [];
  const state = { depth: 0, inStr: false, esc: false, buf: "" };
  const chars = Array.from(body);
  for (const [i, ch] of chars.entries()) {
    state.buf += ch;
    if (state.inStr) {
      if (state.esc) {
        state.esc = false;
      } else if (ch === "\\") {
        state.esc = true;
      } else if (ch === '"') {
        state.inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      state.inStr = true;
    } else if (ch === '{') {
      state.depth += 1;
    } else if (ch === '}') {
      state.depth = Math.max(0, state.depth - 1);
    }

    if (state.depth === 0 && state.buf.trim()) {
      const candidate = state.buf.trim();
      const obj = tryParse(candidate);
      if (isGeminiResponse(obj)) {
        chunks.push(obj as GenerateContentResponse);
        state.buf = "";
        // Skip trailing comma/whitespace between objects
        const nextIndex = i + 1;
        if (nextIndex < chars.length) {
          // advance over subsequent whitespace/commas in the loop naturally via continue
        }
      }
    }
  }
  if (chunks.length > 0) {
    return { mode: "json-chunks", chunks };
  }

  // 4) Fallback: treat as raw text lines (preserve as-is)
  return { mode: "text", lines };
}

/**
 * Convenience: read a saved .log and parse it.
 */
export async function parseNonSseLogFile(path: string): Promise<NonSseParseResult> {
  const body = await readFile(path, { encoding: "utf8" });
  return parseNonSseBody(body);
}

/**
 * Utility: stitch candidate text from chunks (best‑effort, tolerant of shape).
 */
export function concatCandidateTexts(chunks: GenerateContentResponse[]): string {
  const texts: string[] = [];
  for (const c of chunks) {
    for (const p of getCandidateParts(c)) {
      if (isGeminiTextPart(p)) {
        texts.push(p.text);
      }
    }
  }
  return texts.join("");
}
