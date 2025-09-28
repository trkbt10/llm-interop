/**
 * @file Harmony to Responses API Converter.
 *
 * Converts parsed Harmony messages to OpenAI Responses API events
 */

import { HARMONY_CHANNELS } from "../constants";
import type { HarmonyMessage } from "../types";
import { parseHarmonyResponse } from "./parse-response";
import type { HarmonyParsedToolCall, HarmonyToResponsesOptions, ParsedHarmonyResponse } from "./types";
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

  const builder = new HarmonyResponsesEventBuilder(resolvedOptions);
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

export class HarmonyResponsesEventBuilder {
  public readonly responseId: string;
  public readonly createdAt: number;
  private readonly model: string;

  private started = false;
  private sequenceNumber = 0;
  private outputIndexCounter = 0;
  private readonly outputs: Array<ResponseOutputMessage | ResponseFunctionToolCall> = [];

  private reasoningState: TextItemState | undefined;
  private finalState: TextItemState | undefined;

  constructor(private readonly options: BuilderOptions, context: { responseId?: string; createdAt?: number } = {}) {
    this.responseId = context.responseId ?? resolveResponseId(options);
    this.createdAt = context.createdAt ?? Math.floor(Date.now() / 1000);
    this.model = resolveModel(options);
  }

  start(): ResponseCreatedEvent {
    if (this.started) {
      throw new Error("HarmonyResponsesEventBuilder.start must only be called once");
    }
    this.started = true;
    return createResponseCreated(this.responseId, this.createdAt, this.model, this.nextSequence());
  }

  appendReasoning(content: string): ResponseStreamEvent[] {
    this.ensureStarted();
    const normalized = normalizeOutputText(content);
    if (!normalized) {
      return [];
    }

    const events: ResponseStreamEvent[] = [];
    const state = this.ensureReasoningState(events);
    const addition = state.text ? `\n\n${normalized}` : normalized;

    const segments = this.options.stream ? splitIntoChunks(addition, REASONING_CHUNK_SIZE) : [addition];
    for (const segment of segments) {
      events.push(
        createTextDelta(
          state.itemId,
          segment,
          state.arrayIndex,
          state.contentIndex,
          this.nextSequence(),
        ),
      );
      state.contentIndex += segment.length;
    }

    state.text += addition;
    state.item.content[0].text = state.text;

    return events;
  }

  appendFinal(content: string): ResponseStreamEvent[] {
    this.ensureStarted();
    const normalized = normalizeOutputText(content);
    if (!normalized) {
      return [];
    }

    const events: ResponseStreamEvent[] = [];
    const state = this.ensureFinalState(events);
    const addition = state.text ? `\n\n${normalized}` : normalized;

    const segments = this.options.stream ? splitIntoChunks(addition, TEXT_CHUNK_SIZE) : [addition];
    for (const segment of segments) {
      events.push(
        createTextDelta(
          state.itemId,
          segment,
          state.arrayIndex,
          state.contentIndex,
          this.nextSequence(),
        ),
      );
      state.contentIndex += segment.length;
    }

    state.text += addition;
    state.item.content[0].text = state.text;

    return events;
  }

  appendToolCall(toolCall: HarmonyParsedToolCall): ResponseStreamEvent[] {
    this.ensureStarted();

    const itemId = `${this.responseId}_tool_${toolCall.id}`;
    const item = createFunctionCallItem(itemId, toolCall);
    this.outputs.push(item);
    const arrayIndex = this.outputs.length - 1;
    const outputIndexEvent = this.reserveOutputIndex();

    const events: ResponseStreamEvent[] = [];
    events.push(createOutputItemAdded(item, this.nextSequence(), outputIndexEvent));

    if (this.options.stream) {
      events.push(createFunctionCallArgumentsDelta(itemId, arrayIndex, this.nextSequence()));
      const segments = splitIntoChunks(toolCall.arguments, ARGUMENT_CHUNK_SIZE);
      for (const segment of segments) {
        events.push(createFunctionCallArgumentsDelta(itemId, arrayIndex, this.nextSequence(), segment));
      }
    }

    events.push(
      createFunctionCallArgumentsDone(itemId, arrayIndex, toolCall.arguments, this.nextSequence()),
    );
    events.push(createOutputItemDone(item, this.nextSequence(), arrayIndex));

    return events;
  }

  finish(): ResponseStreamEvent[] {
    this.ensureStarted();
    const events: ResponseStreamEvent[] = [];

    if (this.reasoningState && this.reasoningState.open) {
      events.push(
        createTextDone(
          this.reasoningState.itemId,
          this.reasoningState.text,
          this.reasoningState.arrayIndex,
          this.reasoningState.contentIndex,
          this.nextSequence(),
        ),
      );
      events.push(
        createOutputItemDone(
          this.reasoningState.item,
          this.nextSequence(),
          this.reasoningState.arrayIndex,
        ),
      );
      this.reasoningState.open = false;
    }

    if (this.finalState && this.finalState.open) {
      events.push(
        createTextDone(
          this.finalState.itemId,
          this.finalState.text,
          this.finalState.arrayIndex,
          this.finalState.contentIndex,
          this.nextSequence(),
        ),
      );
      events.push(
        createOutputItemDone(
          this.finalState.item,
          this.nextSequence(),
          this.finalState.arrayIndex,
        ),
      );
      this.finalState.open = false;
    }

    events.push(
      createResponseCompleted(
        this.responseId,
        this.createdAt,
        this.model,
        this.outputs,
        this.nextSequence(),
      ),
    );

    return events;
  }

  private ensureReasoningState(events: ResponseStreamEvent[]): TextItemState {
    if (this.reasoningState) {
      return this.reasoningState;
    }

    const itemId = `${this.responseId}_reasoning`;
    const item = createReasoningItem(itemId, "");
    this.outputs.push(item);
    const arrayIndex = this.outputs.length - 1;
    const outputIndexEvent = this.reserveOutputIndex();

    events.push(createOutputItemAdded(item, this.nextSequence(), outputIndexEvent));

    this.reasoningState = {
      itemId,
      item,
      arrayIndex,
      contentIndex: 0,
      text: "",
      open: true,
    };

    return this.reasoningState;
  }

  private ensureFinalState(events: ResponseStreamEvent[]): TextItemState {
    if (this.finalState) {
      return this.finalState;
    }

    const itemId = `${this.responseId}_text`;
    const item = createMessageItem(itemId, "");
    this.outputs.push(item);
    const arrayIndex = this.outputs.length - 1;
    const outputIndexEvent = this.reserveOutputIndex();

    events.push(createOutputItemAdded(item, this.nextSequence(), outputIndexEvent));

    this.finalState = {
      itemId,
      item,
      arrayIndex,
      contentIndex: 0,
      text: "",
      open: true,
    };

    return this.finalState;
  }

  private ensureStarted(): void {
    if (!this.started) {
      throw new Error("HarmonyResponsesEventBuilder.start must be called before appending output");
    }
  }

  private nextSequence(): number {
    this.sequenceNumber += 1;
    return this.sequenceNumber;
  }

  private reserveOutputIndex(): number {
    this.outputIndexCounter += 1;
    return this.outputIndexCounter;
  }
}

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
