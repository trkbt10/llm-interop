/**
 * @file Stream handler for converting Gemini responses to OpenAI Responses API format
 */
import type {
  ResponseCompletedEvent,
  ResponseCreatedEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseTextDeltaEvent,
  ResponseTextDoneEvent,
  ResponseStreamEvent,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";
import type { StreamedPart } from "../../../providers/gemini/client/fetch-client";
import { generateId } from "../../conversation/id-conversion";

// ===== State Types =====

type StreamState = {
  responseId: string;
  model: string;
  created: number;
  sequenceNumber: number;
  outputIndex: number;
  contentIndex: number;
  isInitialized: boolean;
  currentTextItem?: { id: string; text: string };
  textBuffer: string;
  // Parsing modes stack: text or fenced code block
  modeStack: Array<
    | { type: "text" }
    | { type: "fence"; fenceChar: "`" | "~"; fenceLen: number; info?: string }
  >;
  pendingEvents: ResponseStreamEvent[];
};

// ===== Action Types =====

type StreamAction =
  | { type: "INIT" }
  | { type: "TEXT"; text: string }
  | { type: "FUNCTION_CALL"; functionCall: { name?: string; args?: unknown } }
  | { type: "COMPLETE"; finishReason?: string };

// ===== Event Creators =====

const createResponseCreated = (state: StreamState): ResponseCreatedEvent => ({
  type: "response.created",
  response: {
    id: state.responseId,
    created_at: state.created,
    output_text: "",
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    model: state.model,
    object: "response",
    output: [],
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    status: "in_progress",
  },
  sequence_number: state.sequenceNumber++,
});

const createTextItemAdded = (state: StreamState, itemId: string): ResponseOutputItemAddedEvent => ({
  type: "response.output_item.added",
  sequence_number: state.sequenceNumber++,
  output_index: state.outputIndex++,
  item: {
    id: itemId,
    type: "message",
    role: "assistant",
    content: [],
    status: "completed",
  },
});

const createTextDelta = (state: StreamState, text: string): ResponseTextDeltaEvent => {
  const event: ResponseTextDeltaEvent = {
    type: "response.output_text.delta",
    delta: text,
    item_id: state.currentTextItem!.id,
    output_index: state.outputIndex - 1,
    content_index: state.contentIndex,
    logprobs: [],
    sequence_number: state.sequenceNumber++,
  };
  state.contentIndex += text.length;
  return event;
};

const createTextDone = (state: StreamState): ResponseTextDoneEvent => ({
  type: "response.output_text.done",
  item_id: state.currentTextItem!.id,
  output_index: state.outputIndex - 1,
  content_index: state.contentIndex,
  logprobs: [],
  sequence_number: state.sequenceNumber++,
  text: state.currentTextItem!.text,
});

const createTextItemDone = (state: StreamState): ResponseOutputItemDoneEvent => ({
  type: "response.output_item.done",
  sequence_number: state.sequenceNumber++,
  output_index: state.outputIndex - 1,
  item: {
    id: state.currentTextItem!.id,
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text: state.currentTextItem!.text, annotations: [] }],
    status: "completed",
  },
});

const createFunctionCallAdded = (
  state: StreamState,
  itemId: string,
  functionCall: { name?: string; args?: unknown },
): ResponseOutputItemAddedEvent => ({
  type: "response.output_item.added",
  sequence_number: state.sequenceNumber++,
  output_index: state.outputIndex++,
  item: {
    id: itemId,
    type: "function_call",
    call_id: itemId,
    name: functionCall.name ? functionCall.name : "unknown_function",
    arguments: JSON.stringify(functionCall.args ? functionCall.args : {}),
  } as ResponseFunctionToolCall,
});

const createFunctionCallDone = (
  state: StreamState,
  itemId: string,
  functionCall: { name?: string; args?: unknown },
): ResponseOutputItemDoneEvent => ({
  type: "response.output_item.done",
  sequence_number: state.sequenceNumber++,
  output_index: state.outputIndex - 1,
  item: {
    id: itemId,
    type: "function_call",
    call_id: itemId,
    name: functionCall.name ? functionCall.name : "unknown_function",
    arguments: JSON.stringify(functionCall.args ? functionCall.args : {}),
  } as ResponseFunctionToolCall,
});

const createResponseCompleted = (state: StreamState, finishReason?: string): ResponseCompletedEvent => ({
  type: "response.completed",
  response: {
    id: state.responseId,
    created_at: state.created,
    output_text: state.currentTextItem?.text ? state.currentTextItem.text : "",
    error: null,
    incomplete_details: finishReason === "STOP" ? null : { reason: "max_output_tokens" },
    instructions: null,
    metadata: null,
    model: state.model,
    object: "response",
    output: [],
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    status: finishReason === "STOP" ? "completed" : "incomplete",
  },
  sequence_number: state.sequenceNumber++,
});

// ===== Helper Functions =====

const topMode = (state: StreamState) => state.modeStack[state.modeStack.length - 1];

const processTextBuffer = (state: StreamState): void => {
  const buf = state.textBuffer;
  // eslint-disable-next-line no-restricted-syntax -- Index pointer for scanning buffer
  let pos = 0;
  // eslint-disable-next-line no-restricted-syntax -- Tracks last emitted position to slice deltas efficiently
  let lastEmit = 0;
  const events: ResponseStreamEvent[] = [];

  const isLineStart = (i: number) => i === 0 || buf[i - 1] === "\n";

  const countRun = (i: number, ch: string) => {
    // eslint-disable-next-line no-restricted-syntax -- Local counter for scanning contiguous fence chars
    let n = 0;
    while (i + n < buf.length && buf[i + n] === ch) {
      n++;
    }
    return n;
  };

  while (pos < buf.length) {
    // Fence detection at line start
    if (isLineStart(pos)) {
      const ch = buf[pos];
      if (ch === "`" || ch === "~") {
        const run = countRun(pos, ch);
        if (run >= 3) {
          // find end of line
          // eslint-disable-next-line no-restricted-syntax -- Track end-of-line index when scanning fences
          let lineEnd = buf.indexOf("\n", pos);
          if (lineEnd === -1) {
            lineEnd = buf.length;
          }
          const fenceLine = buf.substring(pos, lineEnd);
          const onlyFenceAndSpaces = new RegExp(`^[${ch}]` + `{${run},}\\s*$`).test(fenceLine);
          const mode = topMode(state);
          if (mode.type === "fence") {
            // Closing fence: same char, length >= open, no extra text
            if (mode.fenceChar === ch && run >= mode.fenceLen && onlyFenceAndSpaces) {
              // include closing fence line fully
              const closeEnd = lineEnd < buf.length ? lineEnd + 1 : lineEnd;
              const chunk = buf.substring(lastEmit, closeEnd);
              if (chunk) {
                events.push(createTextDelta(state, chunk));
              }
              state.modeStack.pop();
              lastEmit = closeEnd;
              pos = closeEnd;
              continue;
            }
          } else {
            // Opening fence: enter fence mode, postpone emission until closing
            state.modeStack.push({ type: "fence", fenceChar: ch, fenceLen: run });
            // move past whole fence line
            pos = lineEnd < buf.length ? lineEnd + 1 : lineEnd;
            // do not change lastEmit so that the whole block (including any text before fence line)
            // is emitted as a single delta at close time
            continue;
          }
        }
      }
    }

    // paragraph split only in text mode
    if (
      topMode(state).type === "text" &&
      buf[pos] === "\n" &&
      pos + 1 < buf.length &&
      buf[pos + 1] === "\n"
    ) {
      const chunk = buf.substring(lastEmit, pos + 2);
      if (chunk) {
        events.push(createTextDelta(state, chunk));
      }
      lastEmit = pos + 2;
      pos += 2;
      continue;
    }

    pos++;
  }

  // Keep unprocessed tail in buffer
  state.textBuffer = buf.substring(lastEmit);
  state.pendingEvents = [...state.pendingEvents, ...events];
};

// ===== Reducer =====

const streamReducer = (state: StreamState, action: StreamAction): StreamState => {
  const newState = { ...state, pendingEvents: [] as ResponseStreamEvent[] };

  switch (action.type) {
    case "INIT": {
      newState.responseId = generateId("resp");
      newState.created = Math.floor(Date.now() / 1000);
      newState.isInitialized = true;
      newState.pendingEvents = [...newState.pendingEvents, createResponseCreated(newState)];
      break;
    }

    case "TEXT": {
      // Start text item if needed
      if (!newState.currentTextItem) {
        const itemId = generateId("msg");
        newState.currentTextItem = { id: itemId, text: "" };
        newState.pendingEvents = [...newState.pendingEvents, createTextItemAdded(newState, itemId)];
      }

      // Add to accumulated text and buffer
      newState.currentTextItem.text += action.text;
      newState.textBuffer += action.text;

      // Process buffer for paragraph breaks
      processTextBuffer(newState);
      break;
    }

    case "FUNCTION_CALL": {
      if (action.functionCall) {
        const itemId = generateId("fc");
        newState.pendingEvents = [
          ...newState.pendingEvents,
          createFunctionCallAdded(newState, itemId, action.functionCall),
          createFunctionCallDone(newState, itemId, action.functionCall),
        ];
      }
      break;
    }

    case "COMPLETE": {
      // Flush remaining text buffer
      if (newState.textBuffer && newState.currentTextItem) {
        newState.pendingEvents = [...newState.pendingEvents, createTextDelta(newState, newState.textBuffer)];
        newState.textBuffer = "";
      }

      // Close current text item
      if (newState.currentTextItem) {
        newState.pendingEvents = [...newState.pendingEvents, createTextDone(newState), createTextItemDone(newState)];
      }

      // Emit completion
      newState.pendingEvents = [...newState.pendingEvents, createResponseCompleted(newState, action.finishReason)];
      break;
    }
  }

  return newState;
};

// ===== Stream Handler Functions =====

export type GeminiStreamHandlerState = {
  state: StreamState;
};

export const createGeminiStreamHandler = (model: string = "gemini-pro"): GeminiStreamHandlerState => {
  return {
    state: createInitialState(model),
  };
};

const createInitialState = (model: string): StreamState => {
  return {
    responseId: "",
    model,
    created: 0,
    sequenceNumber: 1,
    outputIndex: 0,
    contentIndex: 0,
    isInitialized: false,
    currentTextItem: undefined,
    textBuffer: "",
    modeStack: [{ type: "text" }],
    pendingEvents: [],
  };
};

/**
 * Processes Gemini streaming parts and converts them into OpenAI Response API events.
 * Manages the complex state transitions required to transform Gemini's streaming format
 * into Response API event sequences, handling text deltas, function calls, and completion
 * states. Essential for enabling Gemini streaming responses within Response API workflows.
 *
 * @param handler - Gemini stream handler state managing conversion state and event buffering
 * @param stream - Async iterable of Gemini streaming parts requiring conversion
 * @yields Response API stream events representing the converted Gemini content
 */
export async function* handleStream(
  handler: GeminiStreamHandlerState,
  stream: AsyncIterable<StreamedPart>,
): AsyncGenerator<ResponseStreamEvent, void, unknown> {
  for await (const part of stream) {
    // Initialize on first part
    if (!handler.state.isInitialized) {
      handler.state = streamReducer(handler.state, { type: "INIT" });
      yield* handler.state.pendingEvents;
    }

    // Map part to action
    const action: StreamAction | undefined = (() => {
      switch (part.type) {
        case "text":
          return part.text ? { type: "TEXT", text: part.text } : undefined;
        case "functionCall":
          return { type: "FUNCTION_CALL", functionCall: part.functionCall ? part.functionCall : {} };
        case "complete":
          return { type: "COMPLETE", finishReason: part.finishReason };
        default:
          return undefined;
      }
    })();

    // Process action
    if (action) {
      handler.state = streamReducer(handler.state, action);
      yield* handler.state.pendingEvents;
    }
  }
}

/**
 * Resets Gemini stream handler state to initial conditions for processing new streams.
 * Provides a clean slate for processing subsequent Gemini streams by reinitializing
 * all state tracking variables and clearing any pending events. Essential for reusing
 * stream handlers across multiple streaming sessions without state contamination.
 *
 * @param handler - Gemini stream handler state requiring reset to initial conditions
 */
export const resetHandler = (handler: GeminiStreamHandlerState): void => {
  handler.state = createInitialState(handler.state.model);
};

// Function-based API is the recommended approach - use createGeminiStreamHandler and handleStream functions
