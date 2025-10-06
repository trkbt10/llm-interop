/**
 * @file Event creator functions for Responses API events
 */

import type { HarmonyParsedToolCall } from "../types";
import type {
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
  ResponseReasoningItem,
  ResponseReasoningTextDeltaEvent,
  ResponseReasoningTextDoneEvent,
} from "openai/resources/responses/responses";

export const createResponseCreated = (
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

export const createResponseCompleted = (
  responseId: string,
  created: number,
  model: string,
  output: Array<ResponseOutputMessage | ResponseFunctionToolCall | ResponseReasoningItem>,
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

export const createOutputItemAdded = (
  item: ResponseOutputMessage | ResponseFunctionToolCall | ResponseReasoningItem,
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

export const createOutputItemDone = (
  item: ResponseOutputMessage | ResponseFunctionToolCall | ResponseReasoningItem,
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

export const createTextDelta = (
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

export const createTextDone = (
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

export const createReasoningTextDelta = (
  itemId: string,
  text: string,
  outputIndex: number,
  contentIndex: number,
  sequenceNumber: number,
): ResponseReasoningTextDeltaEvent => {
  return {
    type: "response.reasoning_text.delta",
    item_id: itemId,
    output_index: outputIndex,
    content_index: contentIndex,
    delta: text,
    sequence_number: sequenceNumber,
  };
};

export const createReasoningTextDone = (
  itemId: string,
  text: string,
  outputIndex: number,
  contentIndex: number,
  sequenceNumber: number,
): ResponseReasoningTextDoneEvent => {
  return {
    type: "response.reasoning_text.done",
    item_id: itemId,
    output_index: outputIndex,
    content_index: contentIndex,
    text,
    sequence_number: sequenceNumber,
  };
};

export const createFunctionCallArgumentsDelta = (
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

export const createFunctionCallArgumentsDone = (
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

export const createMessageItem = (itemId: string, text: string): ResponseOutputMessage => {
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

export const createReasoningItem = (itemId: string): ResponseReasoningItem => {
  return {
    id: itemId,
    type: "reasoning",
    summary: [],
    content: [
      {
        text: "",
        type: "reasoning_text",
      },
    ],
    status: "in_progress",
  };
};

export const createFunctionCallItem = (itemId: string, toolCall: HarmonyParsedToolCall): ResponseFunctionToolCall => {
  return {
    id: itemId,
    type: "function_call",
    call_id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments,
    status: "completed",
  };
};

const extractOutputText = (output: Array<ResponseOutputMessage | ResponseFunctionToolCall | ResponseReasoningItem>): string => {
  const textItems = output.filter((item): item is ResponseOutputMessage => item.type === "message");
  if (textItems.length === 0) {
    return "";
  }

  const lastTextItem = textItems[textItems.length - 1];
  const textContent = lastTextItem.content?.find((c) => c.type === "output_text");
  return textContent && "text" in textContent ? textContent.text : "";
};