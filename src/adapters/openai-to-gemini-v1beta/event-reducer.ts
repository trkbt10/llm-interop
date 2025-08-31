/**
 * @file Event processing reducer for OpenAI → Gemini v1beta streaming conversion.
 * Maps OpenAI Responses streaming events to Gemini v1beta stream chunks
 * including text deltas and function calls.
 */
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { isOutputTextDeltaEvent } from "../../providers/openai/responses-guards";
import {
  isFunctionCallItem,
  isOutputItemAddedEvent,
  isOutputItemDoneEvent,
  isFunctionCallArgumentsDeltaEvent,
} from "../../providers/openai/responses-guards";
import type { GeminiStreamChunk } from "./core/gemini-types";

/** Lightweight state for assembling function call arguments across delta events. */
export type GeminiStreamState = {
  fnArgs: Map<string, string>;
  fnNames: Map<string, string>;
  onError?: (info: { code: string; message: string; snippet?: string }) => void;
};

/** Create initial reducer state */
export function createInitialState(opts?: { onError?: GeminiStreamState["onError"] }): GeminiStreamState {
  return { fnArgs: new Map(), fnNames: new Map(), onError: opts?.onError };
}

/** Convert a text delta into a Gemini chunk */
function textChunk(delta: string): GeminiStreamChunk {
  return { candidates: [{ content: { parts: [{ text: delta }], role: "model" }, index: 0 }] };
}

/** Convert a function call start into a Gemini chunk */
function functionCallChunk(name: string, args?: Record<string, unknown>): GeminiStreamChunk {
  return {
    candidates: [
      {
        content: {
          parts: [
            args ? { functionCall: { name, args } } : { functionCall: { name } },
          ],
          role: "model",
        },
        index: 0,
      },
    ],
  };
}

/**
 * Process a single OpenAI streaming event into zero or more Gemini chunks, updating state.
 */
export function processOpenAIEventToGemini(
  state: GeminiStreamState,
  event: ResponseStreamEvent,
): { state: GeminiStreamState; chunks: GeminiStreamChunk[] } {
  const out: GeminiStreamChunk[] = [];
  // Text delta
  if (isOutputTextDeltaEvent(event)) {
    const delta = event.delta ?? "";
    if (delta) {
      out.push(textChunk(delta));
    }
    return { state, chunks: out };
  }

  // Function call item added (start)
  if (isOutputItemAddedEvent(event)) {
    if (isFunctionCallItem(event.item)) {
      // Start of a function call; initialize arg buffer
      state.fnArgs.set(event.item.id, "");
      const name = typeof event.item.name === "string" ? event.item.name : "";
      if (name) {
        state.fnNames.set(event.item.id, name);
      }
      if (name) {
        out.push(functionCallChunk(name));
      }
      return { state, chunks: out };
    }
    return { state, chunks: out };
  }

  // Function call arguments delta
  if (isFunctionCallArgumentsDeltaEvent(event)) {
    const itemId = event.item_id ?? "";
    const prev = state.fnArgs.get(itemId) ?? "";
    const nextStr = prev + (event.delta ?? "");
    state.fnArgs.set(itemId, nextStr);
    // 途中段階では、完全なJSONが得られた時のみ args を出力。未完成時は黙って待つ（startでnameは既に出している）。
    if (isLikelyCompleteJsonObject(nextStr)) {
      const parsed = safeParseJsonObject(nextStr, state);
      if (parsed) {
        const name = state.fnNames.get(itemId) ?? "";
        out.push(functionCallChunk(name, parsed));
      }
    }
    return { state, chunks: out };
  }

  // Function call output item done → 最終的に JSON が完成していなければエラーにする（握りつぶさない）。
  if (isOutputItemDoneEvent(event)) {
    const itemId = event.item.id ?? "";
    const acc = state.fnArgs.get(itemId);
    if (acc && !isLikelyCompleteJsonObject(acc)) {
      const msg = "Function call arguments did not form a complete JSON object by output_item.done";
      if (state.onError) {
        state.onError({ code: "args_incomplete", message: msg, snippet: acc.slice(0, 200) });
      } else {
        // デフォルトでも失敗を可視化（例外）
        throw new Error(`[v1beta reducer] ${msg}`);
      }
    }
    // Clean up buffers for this item
    state.fnArgs.delete(itemId);
    state.fnNames.delete(itemId);
    return { state, chunks: out };
  }

  // Ignore other events for now
  return { state, chunks: out };
}

// moved guards to providers/openai/responses-guards

function isLikelyCompleteJsonObject(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) {
    return false;
  }
  const state = { depth: 0, inStr: false, esc: false };
  for (const ch of t) {
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
  }
  return state.depth === 0;
}

function safeParseJsonObject(s: string, state: GeminiStreamState): Record<string, unknown> | undefined {
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === 'object') {
      return obj as Record<string, unknown>;
    }
    if (state.onError) {
      state.onError({ code: 'args_not_object', message: 'Function call arguments is not an object', snippet: s.slice(0, 200) });
    }
    return undefined;
  } catch (e) {
    if (state.onError) {
      const msg = (e as Error).message;
      state.onError({ code: 'args_json_parse_error', message: msg, snippet: s.slice(0, 200) });
    }
    return undefined;
  }
}
