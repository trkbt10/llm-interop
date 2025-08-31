/**
 * @file Handles streaming responses from Chat Completions API and converts to Responses API events
 */
import type {
  ResponseCreatedEvent,
  ResponseTextDeltaEvent,
  ResponseTextDoneEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseCompletedEvent,
} from "openai/resources/responses/responses";
import type {
  ResponseStreamEvent,
  ChatCompletionChunk,
  OpenAIResponse,
  ResponseOutputItem,
  ResponseFunctionToolCall,
  ChatCompletionMessageToolCall,
} from "./types";

/**
 * State type for tracking stream handler state across chunks
 */
export type StreamHandlerState = {
  responseId: string | undefined;
  model: string | undefined;
  created: number | undefined;
  currentFunctionItemId: string | undefined;
  currentFunctionCallId: string | undefined;
  textItemId: string | undefined;
  sequenceNumber: number;
  outputIndex: number;
  contentIndex: number;
  accumulatedText: string;
};

/**
 * Creates initial state for stream handler
 */
export function createStreamHandlerState(): StreamHandlerState {
  return {
    responseId: undefined,
    model: undefined,
    created: undefined,
    currentFunctionItemId: undefined,
    currentFunctionCallId: undefined,
    textItemId: undefined,
    sequenceNumber: 0,
    outputIndex: 0,
    contentIndex: 0,
    accumulatedText: "",
  };
}

function generateId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${randomPart}`;
}

function nextSeq(state: StreamHandlerState): number {
  state.sequenceNumber += 1;
  return state.sequenceNumber;
}

function initializeMetadata(state: StreamHandlerState, chunk: ChatCompletionChunk): void {
  state.responseId = chunk.id;
  state.model = chunk.model;
  state.created = chunk.created;
}

function* handleToolCallsDelta(
  state: StreamHandlerState,
  toolCallDeltas: Array<ChatCompletionMessageToolCall>,
): Generator<ResponseStreamEvent, void, unknown> {
  for (const t of toolCallDeltas) {
    if (t.id && (!state.currentFunctionCallId || state.currentFunctionCallId !== t.id)) {
      if (state.currentFunctionItemId) {
        const doneItem: ResponseOutputItem = {
          type: "function_call",
          id: state.currentFunctionItemId!,
          name: "",
          call_id: state.currentFunctionCallId!,
          arguments: "",
        } as ResponseFunctionToolCall & { id: string } as ResponseOutputItem;
        const doneEv: ResponseOutputItemDoneEvent = {
          type: "response.output_item.done",
          item: doneItem,
          output_index: state.outputIndex,
          sequence_number: nextSeq(state),
        };
        yield doneEv as ResponseStreamEvent;
      }
      state.currentFunctionCallId = t.id;
      state.currentFunctionItemId = generateId("fc");
      const name = t.type === "function" ? (t.function?.name ?? "") : "";
      const args = t.type === "function" ? (t.function?.arguments ?? "") : "";
      const item: ResponseFunctionToolCall & { id: string } = {
        type: "function_call",
        id: state.currentFunctionItemId,
        name,
        call_id: t.id,
        arguments: args,
      };
      const addedEv: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: item as ResponseOutputItem,
        output_index: state.outputIndex,
        sequence_number: nextSeq(state),
      };
      yield addedEv as ResponseStreamEvent;
    }
    const args = t.type === "function" ? t.function?.arguments : undefined;
    if (typeof args === "string" && args.length > 0 && state.currentFunctionItemId) {
      const argsEv: ResponseFunctionCallArgumentsDeltaEvent = {
        type: "response.function_call_arguments.delta",
        item_id: state.currentFunctionItemId,
        output_index: state.outputIndex,
        sequence_number: nextSeq(state),
        delta: args,
      };
      yield argsEv as ResponseStreamEvent;
    }
  }
}

function* processChunk(
  state: StreamHandlerState,
  chunk: ChatCompletionChunk,
): Generator<ResponseStreamEvent, void, unknown> {
  if (!state.responseId) {
    initializeMetadata(state, chunk);
    const response: OpenAIResponse = {
      id: state.responseId!,
      created_at: state.created!,
      output_text: "",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      model: (() => {
        if (state.model) {
          return state.model;
        }
        return "unknown";
      })(),
      object: "response",
      output: [],
      parallel_tool_calls: true,
      temperature: null,
      tool_choice: "auto",
      tools: [],
      top_p: null,
      status: "in_progress",
    };
    const created: ResponseCreatedEvent = { type: "response.created", response, sequence_number: nextSeq(state) };
    yield created as ResponseStreamEvent;
  }

  const delta = chunk.choices[0]?.delta;
  if (!delta) {
    return;
  }

  if (typeof delta.content === "string" && delta.content.length > 0) {
    if (!state.textItemId) {
      state.textItemId = generateId("msg");
    }
    const deltaEv: ResponseTextDeltaEvent = {
      type: "response.output_text.delta",
      delta: delta.content,
      item_id: state.textItemId,
      output_index: state.outputIndex,
      content_index: state.contentIndex,
      logprobs: [],
      sequence_number: nextSeq(state),
    };
    state.accumulatedText += delta.content;
    yield deltaEv as ResponseStreamEvent;
  }

  if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
    yield* handleToolCallsDelta(state, delta.tool_calls as Array<ChatCompletionMessageToolCall>);
  }

  const finishReason = chunk.choices[0]?.finish_reason;
  if (finishReason) {
    if (state.currentFunctionItemId) {
      const doneItem: ResponseOutputItem = {
        type: "function_call",
        id: state.currentFunctionItemId!,
        name: "",
        call_id: state.currentFunctionCallId!,
        arguments: "",
      } as ResponseFunctionToolCall & { id: string } as ResponseOutputItem;
      const doneEv: ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: doneItem,
        output_index: state.outputIndex,
        sequence_number: nextSeq(state),
      };
      yield doneEv as ResponseStreamEvent;
      state.currentFunctionItemId = undefined;
      state.currentFunctionCallId = undefined;
    }
    if (state.textItemId) {
      const textDone: ResponseTextDoneEvent = {
        type: "response.output_text.done",
        item_id: state.textItemId,
        output_index: state.outputIndex,
        content_index: state.contentIndex,
        logprobs: [],
        sequence_number: nextSeq(state),
        text: state.accumulatedText,
      };
      yield textDone as ResponseStreamEvent;
    }
    const finalResponse: OpenAIResponse = {
      id: state.responseId!,
      created_at: state.created!,
      output_text: state.accumulatedText,
      error: null,
      incomplete_details: finishReason === "length" ? { reason: "max_output_tokens" } : null,
      instructions: null,
      metadata: null,
      model: (() => {
        if (state.model) {
          return state.model;
        }
        return "unknown";
      })(),
      object: "response",
      output: [],
      parallel_tool_calls: true,
      temperature: null,
      tool_choice: "auto",
      tools: [],
      top_p: null,
      status: finishReason === "length" ? "incomplete" : "completed",
    };
    const completed: ResponseCompletedEvent = {
      type: "response.completed",
      response: finalResponse,
      sequence_number: nextSeq(state),
    };
    yield completed as ResponseStreamEvent;
  }
}

/**
 * Processes Chat Completion streaming chunks and converts them into Response API events.
 * Manages the complex task of transforming real-time Chat Completion chunks into
 * Response API event sequences, maintaining state across chunks and ensuring proper
 * event ordering. Essential for enabling Chat Completion streaming within Response API workflows.
 *
 * @param state - Stream handler state for tracking across chunks
 * @param stream - Async iterable of Chat Completion chunks from streaming response
 * @yields Response API stream events representing the converted Chat Completion data
 */
export async function* handleStream(
  state: StreamHandlerState,
  stream: AsyncIterable<ChatCompletionChunk>,
): AsyncGenerator<ResponseStreamEvent, void, unknown> {
  for await (const chunk of stream) {
    yield* processChunk(state, chunk);
  }
}

/**
 * Resets stream handler state to initial conditions for processing new streams.
 *
 * @param state - Stream handler state to reset
 */
export function resetStreamHandler(state: StreamHandlerState): void {
  state.responseId = undefined;
  state.model = undefined;
  state.created = undefined;
  state.currentFunctionItemId = undefined;
  state.currentFunctionCallId = undefined;
  state.textItemId = undefined;
  state.sequenceNumber = 0;
  state.outputIndex = 0;
  state.contentIndex = 0;
  state.accumulatedText = "";
}

// Function-based API is the recommended approach - use createStreamHandlerState and handleStream functions
