/**
 * @file Response event builder for Harmony to Responses conversion
 */

import type { HarmonyParsedToolCall, HarmonyToResponsesOptions } from "../types";
import type {
  ResponseStreamEvent,
  ResponseCreatedEvent,
  ResponseOutputMessage,
  ResponseFunctionToolCall,
  ResponseReasoningItem,
} from "openai/resources/responses/responses";
import { REASONING_CHUNK_SIZE, TEXT_CHUNK_SIZE, ARGUMENT_CHUNK_SIZE } from "./constants";
import {
  createResponseCreated,
  createResponseCompleted,
  createOutputItemAdded,
  createOutputItemDone,
  createTextDelta,
  createTextDone,
  createReasoningTextDelta,
  createReasoningTextDone,
  createFunctionCallArgumentsDelta,
  createFunctionCallArgumentsDone,
  createMessageItem,
  createReasoningItem,
  createFunctionCallItem,
} from "./event-creators";
import { normalizeOutputText, splitIntoChunks } from "./utils";
import type { BuilderState, ReasoningItemState, TextItemState } from "./types";

type BuilderOptions = HarmonyToResponsesOptions & { stream: boolean };

export type HarmonyResponsesEventBuilder = {
  start: () => ResponseCreatedEvent;
  appendReasoning: (content: string) => ResponseStreamEvent[];
  finishReasoning: () => ResponseStreamEvent[];
  appendFinal: (content: string) => ResponseStreamEvent[];
  appendToolCall: (toolCall: HarmonyParsedToolCall) => ResponseStreamEvent[];
  finish: () => ResponseStreamEvent[];
};

/**
 * Creates a stateful helper for streaming Harmony output as Responses events.
 */
export const createHarmonyResponsesEventBuilder = (
  options: BuilderOptions,
  context: { responseId?: string; createdAt?: number } = {},
): HarmonyResponsesEventBuilder => {
  const responseId = context.responseId ?? resolveResponseId(options);
  const createdAt = context.createdAt ?? Math.floor(Date.now() / 1000);
  const model = resolveModel(options);

  const outputs: Array<ResponseOutputMessage | ResponseFunctionToolCall | ResponseReasoningItem> = [];

  const builderState: BuilderState = {
    started: false,
    sequenceNumber: 0,
    outputIndexCounter: 0,
  };

  const ensureStarted = () => {
    if (!builderState.started) {
      throw new Error("HarmonyResponsesEventBuilder.start must be called before appending output");
    }
  };

  const nextSequence = () => {
    builderState.sequenceNumber += 1;
    return builderState.sequenceNumber;
  };

  const reserveOutputIndex = () => {
    const index = builderState.outputIndexCounter;
    builderState.outputIndexCounter += 1;
    return index;
  };

  const ensureReasoningState = (events: ResponseStreamEvent[]): ReasoningItemState => {
    if (builderState.reasoningState) {
      return builderState.reasoningState;
    }

    // Generate item ID in the format: rs_{hash}
    const itemId = generateItemId("rs");
    const item = createReasoningItem(itemId);
    outputs.push(item);
    const arrayIndex = outputs.length - 1;
    const outputIndex = reserveOutputIndex();

    events.push(createOutputItemAdded(item, nextSequence(), outputIndex));

    builderState.reasoningState = {
      itemId,
      item,
      arrayIndex,
      outputIndex,
      contentIndex: 0,
      text: "",
      open: true,
    };

    return builderState.reasoningState;
  };

  const ensureFinalState = (events: ResponseStreamEvent[]): TextItemState => {
    if (builderState.finalState) {
      return builderState.finalState;
    }

    // Generate item ID in the format: msg_{hash}
    const itemId = generateItemId("msg");
    const item = createMessageItem(itemId, "");
    outputs.push(item);
    const arrayIndex = outputs.length - 1;
    const outputIndex = reserveOutputIndex();

    events.push(createOutputItemAdded(item, nextSequence(), outputIndex));

    builderState.finalState = {
      itemId,
      item,
      arrayIndex,
      outputIndex,
      contentIndex: 0,
      text: "",
      open: true,
    };

    return builderState.finalState;
  };

  const appendReasoning = (content: string): ResponseStreamEvent[] => {
    ensureStarted();
    const normalized = normalizeOutputText(content);
    if (!normalized) {
      return [];
    }

    const events: ResponseStreamEvent[] = [];
    const state = ensureReasoningState(events);
    const addition = state.text ? `\n\n${normalized}` : normalized;

    const segments = options.stream ? splitIntoChunks(addition, REASONING_CHUNK_SIZE) : [addition];
    for (const segment of segments) {
      events.push(
        createReasoningTextDelta(state.itemId, segment, state.outputIndex, state.contentIndex, nextSequence()),
      );
      state.contentIndex += segment.length;
    }

    state.text += addition;
    // Update the reasoning item's content
    if (state.item.content && state.item.content[0]) {
      state.item.content[0].text = state.text;
    }

    return events;
  };

  const appendFinal = (content: string): ResponseStreamEvent[] => {
    ensureStarted();
    const normalized = normalizeOutputText(content);
    if (!normalized) {
      return [];
    }

    const events: ResponseStreamEvent[] = [];
    const state = ensureFinalState(events);
    const addition = state.text ? `\n\n${normalized}` : normalized;

    const segments = options.stream ? splitIntoChunks(addition, TEXT_CHUNK_SIZE) : [addition];
    for (const segment of segments) {
      events.push(createTextDelta(state.itemId, segment, state.outputIndex, state.contentIndex, nextSequence()));
      state.contentIndex += segment.length;
    }

    state.text += addition;
    const firstContent = state.item.content[0];
    if (firstContent && firstContent.type === "output_text") {
      firstContent.text = state.text;
    }

    return events;
  };

  const appendToolCall = (toolCall: HarmonyParsedToolCall): ResponseStreamEvent[] => {
    ensureStarted();

    // Tool call items use the tool call ID directly as the item ID
    const itemId = toolCall.id;
    const item = createFunctionCallItem(itemId, toolCall);
    outputs.push(item);
    const outputIndex = reserveOutputIndex();

    const events: ResponseStreamEvent[] = [];
    events.push(createOutputItemAdded(item, nextSequence(), outputIndex));

    if (options.stream) {
      events.push(createFunctionCallArgumentsDelta(itemId, outputIndex, nextSequence()));
      const segments = splitIntoChunks(toolCall.arguments, ARGUMENT_CHUNK_SIZE);
      for (const segment of segments) {
        events.push(createFunctionCallArgumentsDelta(itemId, outputIndex, nextSequence(), segment));
      }
    }

    events.push(
      createFunctionCallArgumentsDone(itemId, outputIndex, toolCall.name, toolCall.arguments, nextSequence()),
    );
    events.push(createOutputItemDone(item, nextSequence(), outputIndex));

    return events;
  };

  const finishReasoning = (): ResponseStreamEvent[] => {
    const events: ResponseStreamEvent[] = [];

    if (builderState.reasoningState && builderState.reasoningState.open) {
      events.push(
        createReasoningTextDone(
          builderState.reasoningState.itemId,
          builderState.reasoningState.text,
          builderState.reasoningState.outputIndex,
          builderState.reasoningState.contentIndex,
          nextSequence(),
        ),
      );
      // Mark the reasoning item as completed
      builderState.reasoningState.item.status = "completed";
      events.push(
        createOutputItemDone(builderState.reasoningState.item, nextSequence(), builderState.reasoningState.outputIndex),
      );
      builderState.reasoningState.open = false;
    }

    return events;
  };

  const finish = (): ResponseStreamEvent[] => {
    ensureStarted();
    const events: ResponseStreamEvent[] = [];

    // Close any remaining open reasoning
    if (builderState.reasoningState && builderState.reasoningState.open) {
      events.push(...finishReasoning());
    }

    if (builderState.finalState && builderState.finalState.open) {
      events.push(
        createTextDone(
          builderState.finalState.itemId,
          builderState.finalState.text,
          builderState.finalState.outputIndex,
          builderState.finalState.contentIndex,
          nextSequence(),
        ),
      );
      events.push(
        createOutputItemDone(builderState.finalState.item, nextSequence(), builderState.finalState.outputIndex),
      );
      builderState.finalState.open = false;
    }

    events.push(createResponseCompleted(responseId, createdAt, model, outputs, nextSequence()));

    return events;
  };

  const start = (): ResponseCreatedEvent => {
    if (builderState.started) {
      throw new Error("HarmonyResponsesEventBuilder.start must only be called once");
    }
    builderState.started = true;
    return createResponseCreated(responseId, createdAt, model, nextSequence());
  };

  return {
    start,
    appendReasoning,
    finishReasoning,
    appendFinal,
    appendToolCall,
    finish,
  };
};

function generateItemId(prefix: string): string {
  // Generate an item ID in the format: {prefix}_{hash}
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}${random}`;
}

function resolveResponseId(options: HarmonyToResponsesOptions): string {
  const { requestId } = options;
  if (typeof requestId === "string") {
    return requestId;
  }
  // Generate a response ID in the format: resp_{hash}
  return generateItemId("resp");
}

function resolveModel(options: HarmonyToResponsesOptions): string {
  const { model } = options;
  if (typeof model === "string") {
    return model;
  }
  return "unknown";
}
