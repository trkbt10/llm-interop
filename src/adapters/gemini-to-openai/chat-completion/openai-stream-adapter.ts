/**
 * @file Converts Gemini streaming responses to OpenAI Responses API stream format
 * Transforms Google Gemini streaming generateContent responses into OpenAI-compatible streaming
 * events, handling text deltas, function calls, and completion events while maintaining proper
 * sequence ordering and response state management.
 */
import type { ResponseStreamEvent as OpenAIResponseStreamEvent } from "openai/resources/responses/responses";
import { GenerateContentResponse } from "../../../providers/gemini/client/fetch-client";
import { getCandidateParts, isGeminiFunctionCallPart, isGeminiTextPart } from "../../../providers/gemini/guards";
import { generateOpenAICallId, generateId } from "../../conversation/id-conversion";

function extractText(resp: GenerateContentResponse): string {
  return getCandidateParts(resp)
    .filter(isGeminiTextPart)
    .map((p) => p.text)
    .join("");
}

function extractFunctionCalls(resp: GenerateContentResponse): Array<{ id?: string; name: string; arguments?: string }> {
  const out: Array<{ id?: string; name: string; arguments?: string }> = [];
  for (const p of getCandidateParts(resp)) {
    if (isGeminiFunctionCallPart(p)) {
      const args = p.functionCall.args !== undefined ? JSON.stringify(p.functionCall.args) : undefined;
      out.push({ name: p.functionCall.name, arguments: args });
    }
  }
  return out;
}

type GeminiStreamState = {
  accumulatedText: string;
  emittedAnyTextDelta: boolean;
  lastTextSeen: string;
  seenFnCalls: Set<string>;
  sigToId: Map<string, string>;
};

function createInitialGeminiStreamState(): GeminiStreamState {
  return {
    accumulatedText: "",
    emittedAnyTextDelta: false,
    lastTextSeen: "",
    seenFnCalls: new Set<string>(),
    sigToId: new Map<string, string>(),
  };
}

function calculateTextDelta(text: string, accumulatedText: string): { delta: string; newAccumulated: string } {
  if (text.startsWith(accumulatedText)) {
    const delta = text.slice(accumulatedText.length);
    return { delta, newAccumulated: text };
  }

  if (accumulatedText && accumulatedText.startsWith(text)) {
    return { delta: "", newAccumulated: accumulatedText };
  }

  return { delta: text, newAccumulated: accumulatedText + text };
}

function updateStateForText(
  state: GeminiStreamState,
  text: string,
): {
  newState: GeminiStreamState;
  delta: string;
} {
  const { delta, newAccumulated } = calculateTextDelta(text, state.accumulatedText);

  return {
    newState: {
      ...state,
      accumulatedText: newAccumulated,
      lastTextSeen: text,
      emittedAnyTextDelta: state.emittedAnyTextDelta ? state.emittedAnyTextDelta : delta.length > 0,
    },
    delta,
  };
}

function updateStateForFunctionCall(
  state: GeminiStreamState,
  sig: string,
): {
  newState: GeminiStreamState;
  callId: string;
  shouldProcess: boolean;
} {
  if (state.seenFnCalls.has(sig)) {
    return { newState: state, callId: "", shouldProcess: false };
  }

  const callId = state.sigToId.get(sig) ? state.sigToId.get(sig)! : generateOpenAICallId();
  const newSeenFnCalls = new Set(state.seenFnCalls);
  newSeenFnCalls.add(sig);

  const newSigToId = new Map(state.sigToId);
  newSigToId.set(sig, callId);

  return {
    newState: {
      ...state,
      seenFnCalls: newSeenFnCalls,
      sigToId: newSigToId,
    },
    callId,
    shouldProcess: true,
  };
}

/**
 * Converts Gemini streaming responses to OpenAI Response API stream format
 */
export async function* geminiToOpenAIStream(
  src: AsyncIterable<GenerateContentResponse>,
): AsyncGenerator<OpenAIResponseStreamEvent, void, unknown> {
  const id = generateId("resp");
  yield {
    type: "response.created",
    response: { id, status: "in_progress" },
  } as OpenAIResponseStreamEvent;

  const state = createInitialGeminiStreamState();

  for await (const chunk of src) {
    const text = extractText(chunk);

    if (text) {
      const { newState, delta } = updateStateForText(state, text);
      Object.assign(state, newState);

      if (delta) {
        yield {
          type: "response.output_text.delta",
          delta,
        } as OpenAIResponseStreamEvent;
      }
    }

    const calls = extractFunctionCalls(chunk);
    for (const c of calls) {
      const sig = `${c.name}|${c.arguments ?? ""}`;
      const { newState, callId, shouldProcess } = updateStateForFunctionCall(state, sig);
      Object.assign(state, newState);

      if (!shouldProcess) {
        continue;
      }

      yield {
        type: "response.output_item.added",
        item: {
          type: "function_call",
          id: callId,
          call_id: callId,
          name: c.name,
          arguments: c.arguments,
        },
      } as OpenAIResponseStreamEvent;

      if (c.arguments) {
        yield {
          type: "response.function_call_arguments.delta",
          delta: c.arguments,
          item_id: callId,
        } as OpenAIResponseStreamEvent;
      }

      yield {
        type: "response.output_item.done",
        item: {
          type: "function_call",
          id: callId,
          call_id: callId,
          name: c.name,
          arguments: c.arguments,
        },
      } as OpenAIResponseStreamEvent;
    }
  }

  if (!state.emittedAnyTextDelta) {
    const fallback = state.lastTextSeen ? state.lastTextSeen : "";
    yield {
      type: "response.output_text.delta",
      delta: fallback,
    } as OpenAIResponseStreamEvent;
  }

  yield { type: "response.output_text.done" } as OpenAIResponseStreamEvent;
  yield {
    type: "response.completed",
    response: { id, status: "completed" },
  } as OpenAIResponseStreamEvent;
}
