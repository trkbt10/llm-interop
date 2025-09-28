/**
 * @file Harmony to Responses API Converter.
 *
 * Converts parsed Harmony messages to OpenAI Responses API events
 */

import { HARMONY_CHANNELS } from "../constants";
import type { HarmonyMessage } from "../types";
import { parseHarmonyResponse } from "./parse-response";
import type { HarmonyParsedToolCall, HarmonyToResponsesOptions } from "./types";
import type {
  ResponseStreamEvent,
  ResponseCreatedEvent,
  ResponseCompletedEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseTextDeltaEvent,
  ResponseTextDoneEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseFunctionCallArgumentsDoneEvent,
  ResponseOutputMessage,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";

const REASONING_CHUNK_SIZE = 100;
const TEXT_CHUNK_SIZE = 50;
const ARGUMENT_CHUNK_SIZE = 50;

export const convertHarmonyToResponses = async (
  response: HarmonyMessage,
  options: HarmonyToResponsesOptions = {},
): Promise<ResponseStreamEvent[]> => {
  const parsed = await parseHarmonyResponse(response);
  const resolvedOptions = {
    idPrefix: "harmony",
    stream: false,
    ...options,
  } satisfies HarmonyToResponsesOptions & { idPrefix: string; stream: boolean };

  const builder = createHarmonyResponsesEventBuilder(resolvedOptions);
  const events: ResponseStreamEvent[] = [];

  events.push(builder.start());

  const analysisMessages = parsed.messages.filter((m) => m.channel === HARMONY_CHANNELS.ANALYSIS);
  if (analysisMessages.length > 0) {
    for (const message of analysisMessages) {
      events.push(...builder.appendReasoning(message.content));
    }
  } else if (parsed.reasoning) {
    events.push(...builder.appendReasoning(parsed.reasoning));
  }

  if (parsed.toolCalls) {
    for (const toolCall of parsed.toolCalls) {
      events.push(...builder.appendToolCall(toolCall));
    }
  }

  const finalMessages = parsed.messages.filter((m) => m.channel === HARMONY_CHANNELS.FINAL);
  for (const message of finalMessages) {
    events.push(...builder.appendFinal(message.content));
  }

  events.push(...builder.finish());

  return events;
};

export const createHarmonyToResponsesConverter = (options: HarmonyToResponsesOptions = {}) => {
  return {
    convert: (response: HarmonyMessage) => convertHarmonyToResponses(response, options),
  };
};

type BuilderOptions = HarmonyToResponsesOptions & { idPrefix: string; stream: boolean };

type TextItemState = {
  itemId: string;
  item: ResponseOutputMessage;
  arrayIndex: number;
  contentIndex: number;
  text: string;
  open: boolean;
};
export type HarmonyResponsesEventBuilder = {
  start: () => ResponseCreatedEvent;
  appendReasoning: (content: string) => ResponseStreamEvent[];
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

  const outputs: Array<ResponseOutputMessage | ResponseFunctionToolCall> = [];

  const builderState: {
    started: boolean;
    sequenceNumber: number;
    outputIndexCounter: number;
    reasoningState?: TextItemState;
    finalState?: TextItemState;
  } = {
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
    builderState.outputIndexCounter += 1;
    return builderState.outputIndexCounter;
  };

  const ensureReasoningState = (events: ResponseStreamEvent[]): TextItemState => {
    if (builderState.reasoningState) {
      return builderState.reasoningState;
    }

    const itemId = `${responseId}_reasoning`;
    const item = createReasoningItem(itemId, "");
    outputs.push(item);
    const arrayIndex = outputs.length - 1;
    const outputIndexEvent = reserveOutputIndex();

    events.push(createOutputItemAdded(item, nextSequence(), outputIndexEvent));

    builderState.reasoningState = {
      itemId,
      item,
      arrayIndex,
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

    const itemId = `${responseId}_text`;
    const item = createMessageItem(itemId, "");
    outputs.push(item);
    const arrayIndex = outputs.length - 1;
    const outputIndexEvent = reserveOutputIndex();

    events.push(createOutputItemAdded(item, nextSequence(), outputIndexEvent));

    builderState.finalState = {
      itemId,
      item,
      arrayIndex,
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
        createTextDelta(state.itemId, segment, state.arrayIndex, state.contentIndex, nextSequence()),
      );
      state.contentIndex += segment.length;
    }

    state.text += addition;
    const firstContent = state.item.content[0];
    if (firstContent && firstContent.type === "output_text") {
      firstContent.text = state.text;
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
      events.push(
        createTextDelta(state.itemId, segment, state.arrayIndex, state.contentIndex, nextSequence()),
      );
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

    const itemId = `${responseId}_tool_${toolCall.id}`;
    const item = createFunctionCallItem(itemId, toolCall);
    outputs.push(item);
    const arrayIndex = outputs.length - 1;
    const outputIndexEvent = reserveOutputIndex();

    const events: ResponseStreamEvent[] = [];
    events.push(createOutputItemAdded(item, nextSequence(), outputIndexEvent));

    if (options.stream) {
      events.push(createFunctionCallArgumentsDelta(itemId, arrayIndex, nextSequence()));
      const segments = splitIntoChunks(toolCall.arguments, ARGUMENT_CHUNK_SIZE);
      for (const segment of segments) {
        events.push(createFunctionCallArgumentsDelta(itemId, arrayIndex, nextSequence(), segment));
      }
    }

    events.push(createFunctionCallArgumentsDone(itemId, arrayIndex, toolCall.arguments, nextSequence()));
    events.push(createOutputItemDone(item, nextSequence(), arrayIndex));

    return events;
  };

  const finish = (): ResponseStreamEvent[] => {
    ensureStarted();
    const events: ResponseStreamEvent[] = [];

    if (builderState.reasoningState && builderState.reasoningState.open) {
      events.push(
        createTextDone(
          builderState.reasoningState.itemId,
          builderState.reasoningState.text,
          builderState.reasoningState.arrayIndex,
          builderState.reasoningState.contentIndex,
          nextSequence(),
        ),
      );
      events.push(
        createOutputItemDone(
          builderState.reasoningState.item,
          nextSequence(),
          builderState.reasoningState.arrayIndex,
        ),
      );
      builderState.reasoningState.open = false;
    }

    if (builderState.finalState && builderState.finalState.open) {
      events.push(
        createTextDone(
          builderState.finalState.itemId,
          builderState.finalState.text,
          builderState.finalState.arrayIndex,
          builderState.finalState.contentIndex,
          nextSequence(),
        ),
      );
      events.push(
        createOutputItemDone(
          builderState.finalState.item,
          nextSequence(),
          builderState.finalState.arrayIndex,
        ),
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
    appendFinal,
    appendToolCall,
    finish,
  };
};

function resolveResponseId(options: HarmonyToResponsesOptions & { idPrefix: string }): string {
  const { requestId } = options;
  if (typeof requestId === "string") {
    return requestId;
  }
  return `${options.idPrefix}_${Date.now()}`;
}

function resolveModel(options: HarmonyToResponsesOptions): string {
  const { model } = options;
  if (typeof model === "string") {
    return model;
  }
  return "unknown";
}

const createResponseCreated = (
  responseId: string,
  created: number,
  model: string,
  sequenceNumber: number,
): ResponseCreatedEvent => {
  return {
    type: "response.created",
    response: {
      id: responseId,
      created_at: created,
      output_text: "",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      model,
      object: "response",
      output: [],
      parallel_tool_calls: true,
      temperature: null,
      tool_choice: "auto",
      tools: [],
      top_p: null,
      status: "in_progress",
    },
    sequence_number: sequenceNumber,
  };
};

const createResponseCompleted = (
  responseId: string,
  created: number,
  model: string,
  output: Array<ResponseOutputMessage | ResponseFunctionToolCall>,
  sequenceNumber: number,
): ResponseCompletedEvent => {
  return {
    type: "response.completed",
    response: {
      id: responseId,
      created_at: created,
      output_text: extractOutputText(output),
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      model,
      object: "response",
      output,
      parallel_tool_calls: true,
      temperature: null,
      tool_choice: "auto",
      tools: [],
      top_p: null,
      status: "completed",
    },
    sequence_number: sequenceNumber,
  };
};

const createOutputItemAdded = (
  item: ResponseOutputMessage | ResponseFunctionToolCall,
  sequenceNumber: number,
  outputIndex: number,
): ResponseOutputItemAddedEvent => {
  return {
    type: "response.output_item.added",
    sequence_number: sequenceNumber,
    output_index: outputIndex,
    item,
  };
};

const createOutputItemDone = (
  item: ResponseOutputMessage | ResponseFunctionToolCall,
  sequenceNumber: number,
  outputIndex: number,
): ResponseOutputItemDoneEvent => {
  return {
    type: "response.output_item.done",
    sequence_number: sequenceNumber,
    output_index: outputIndex,
    item,
  };
};

const createTextDelta = (
  itemId: string,
  text: string,
  outputIndex: number,
  contentIndex: number,
  sequenceNumber: number,
): ResponseTextDeltaEvent => {
  return {
    type: "response.output_text.delta",
    delta: text,
    item_id: itemId,
    output_index: outputIndex,
    content_index: contentIndex,
    logprobs: [],
    sequence_number: sequenceNumber,
  };
};

const createTextDone = (
  itemId: string,
  text: string,
  outputIndex: number,
  contentIndex: number,
  sequenceNumber: number,
): ResponseTextDoneEvent => {
  return {
    type: "response.output_text.done",
    item_id: itemId,
    output_index: outputIndex,
    content_index: contentIndex,
    logprobs: [],
    sequence_number: sequenceNumber,
    text,
  };
};

const createFunctionCallArgumentsDelta = (
  itemId: string,
  outputIndex: number,
  sequenceNumber: number,
  args: string = "",
): ResponseFunctionCallArgumentsDeltaEvent => {
  return {
    type: "response.function_call_arguments.delta",
    item_id: itemId,
    output_index: outputIndex,
    delta: args,
    sequence_number: sequenceNumber,
  };
};

const createFunctionCallArgumentsDone = (
  itemId: string,
  outputIndex: number,
  args: string,
  sequenceNumber: number,
): ResponseFunctionCallArgumentsDoneEvent => {
  return {
    type: "response.function_call_arguments.done",
    item_id: itemId,
    output_index: outputIndex,
    arguments: args,
    sequence_number: sequenceNumber,
  };
};

const createMessageItem = (itemId: string, text: string): ResponseOutputMessage => {
  return {
    id: itemId,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "output_text",
        text,
        annotations: [],
      },
    ],
    status: "completed",
  };
};

const createReasoningItem = (itemId: string, reasoning: string): ResponseOutputMessage => {
  return {
    id: itemId,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "output_text",
        text: reasoning,
        annotations: [],
      },
    ],
    status: "completed",
  };
};

const createFunctionCallItem = (
  itemId: string,
  toolCall: HarmonyParsedToolCall,
): ResponseFunctionToolCall => {
  return {
    id: itemId,
    type: "function_call",
    call_id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments,
    status: "completed",
  };
};

const extractOutputText = (output: Array<ResponseOutputMessage | ResponseFunctionToolCall>): string => {
  const textItems = output.filter((item): item is ResponseOutputMessage => item.type === "message");
  if (textItems.length === 0) {
    return "";
  }

  const lastTextItem = textItems[textItems.length - 1];
  const textContent = lastTextItem.content?.find((c) => c.type === "output_text");
  return textContent && "text" in textContent ? textContent.text : "";
};

const splitIntoChunks = (text: string, chunkSize: number): string[] => {
  if (!text) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

const normalizeOutputText = (text: string): string => {
  if (!text) {
    return "";
  }
  return text.replace(/\r/g, "").trim();
};
