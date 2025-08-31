/**
 * @file Type guards for OpenAI Responses API stream events
 *
 * Why: Provides type-safe runtime checks for stream event structures
 * including image generation, code interpreter, and web search events.
 */

import type {
  ResponseStreamEvent,
  ResponseImageGenCallGeneratingEvent,
  ResponseImageGenCallPartialImageEvent,
  ResponseImageGenCallCompletedEvent,
  ResponseImageGenCallInProgressEvent,
  ResponseTextDeltaEvent,
  ResponseCodeInterpreterCallInProgressEvent,
  ResponseCodeInterpreterCallCodeDeltaEvent,
  ResponseCodeInterpreterCallCodeDoneEvent,
  ResponseCodeInterpreterCallInterpretingEvent,
  ResponseCodeInterpreterCallCompletedEvent,
  ResponseWebSearchCallInProgressEvent,
  ResponseWebSearchCallSearchingEvent,
  ResponseWebSearchCallCompletedEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
} from "openai/resources/responses/responses";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if a value is a response event stream
 */
export function isResponseEventStream(v: unknown): v is AsyncIterable<ResponseStreamEvent> {
  return isObject(v) ? Symbol.asyncIterator in v : false;
}

/**
 * Check if a value is a response stream event
 */
export function isResponseStreamEvent(v: unknown): v is ResponseStreamEvent {
  return isObject(v) ? typeof (v as { type?: unknown }).type === "string" : false;
}

/**
 * Ensure all items in a stream are valid ResponseStreamEvents
 */
export async function* ensureOpenAIResponseStream(
  src: AsyncIterable<unknown>,
): AsyncGenerator<ResponseStreamEvent, void, unknown> {
  for await (const it of src) {
    if (isResponseStreamEvent(it)) {
      yield it;
      continue;
    }
    throw new TypeError("Stream chunk is not a valid ResponseStreamEvent");
  }
}

/**
 * Checks if a value is a stream chunk (async iterable).
 * @param value - The value to validate
 * @returns True if value is AsyncIterable
 */
export const isStreamChunk = (value: unknown): value is AsyncIterable<unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  return Symbol.asyncIterator in (value as Record<string, unknown>);
};

// Type guards for OpenAI image generation events
/**
 * Checks if an event is an OpenAI image generation generating event.
 * @param event - The event to validate
 * @returns True if event is ResponseImageGenCallGeneratingEvent
 */
export function isImageGenerationGeneratingEvent(
  event: ResponseStreamEvent,
): event is ResponseImageGenCallGeneratingEvent {
  return event.type === "response.image_generation_call.generating";
}

/**
 * Checks if an event is an OpenAI image generation partial image event.
 * @param event - The event to validate
 * @returns True if event is ResponseImageGenCallPartialImageEvent
 */
export function isImageGenerationPartialImageEvent(
  event: ResponseStreamEvent,
): event is ResponseImageGenCallPartialImageEvent {
  return event.type === "response.image_generation_call.partial_image";
}

/**
 * Checks if an event is an OpenAI image generation completed event.
 * @param event - The event to validate
 * @returns True if event is ResponseImageGenCallCompletedEvent
 */
export function isImageGenerationCompletedEvent(
  event: ResponseStreamEvent,
): event is ResponseImageGenCallCompletedEvent {
  return event.type === "response.image_generation_call.completed";
}

/**
 * Checks if an event is an OpenAI image generation in progress event.
 * @param event - The event to validate
 * @returns True if event is ResponseImageGenCallInProgressEvent
 */
export function isImageGenerationInProgressEvent(
  event: ResponseStreamEvent,
): event is ResponseImageGenCallInProgressEvent {
  return event.type === "response.image_generation_call.in_progress";
}

// Type guards for OpenAI code interpreter events
/**
 * Checks if an event is an OpenAI code interpreter in progress event.
 * @param event - The event to validate
 * @returns True if event is ResponseCodeInterpreterCallInProgressEvent
 */
export function isCodeInterpreterInProgressEvent(
  event: ResponseStreamEvent,
): event is ResponseCodeInterpreterCallInProgressEvent {
  return event.type === "response.code_interpreter_call.in_progress";
}

/**
 * Checks if an event is an OpenAI code interpreter code delta event.
 * @param event - The event to validate
 * @returns True if event is ResponseCodeInterpreterCallCodeDeltaEvent
 */
export function isCodeInterpreterCodeDeltaEvent(
  event: ResponseStreamEvent,
): event is ResponseCodeInterpreterCallCodeDeltaEvent {
  return event.type === "response.code_interpreter_call_code.delta";
}

/**
 * Checks if an event is an OpenAI code interpreter code done event.
 * @param event - The event to validate
 * @returns True if event is ResponseCodeInterpreterCallCodeDoneEvent
 */
export function isCodeInterpreterCodeDoneEvent(
  event: ResponseStreamEvent,
): event is ResponseCodeInterpreterCallCodeDoneEvent {
  return event.type === "response.code_interpreter_call_code.done";
}

/**
 * Checks if an event is an OpenAI code interpreter interpreting event.
 * @param event - The event to validate
 * @returns True if event is ResponseCodeInterpreterCallInterpretingEvent
 */
export function isCodeInterpreterInterpretingEvent(
  event: ResponseStreamEvent,
): event is ResponseCodeInterpreterCallInterpretingEvent {
  return event.type === "response.code_interpreter_call.interpreting";
}

/**
 * Checks if an event is an OpenAI code interpreter completed event.
 * @param event - The event to validate
 * @returns True if event is ResponseCodeInterpreterCallCompletedEvent
 */
export function isCodeInterpreterCompletedEvent(
  event: ResponseStreamEvent,
): event is ResponseCodeInterpreterCallCompletedEvent {
  return event.type === "response.code_interpreter_call.completed";
}

// Type guards for OpenAI web search events
/**
 * Checks if an event is an OpenAI web search in progress event.
 * @param event - The event to validate
 * @returns True if event is ResponseWebSearchCallInProgressEvent
 */
export function isWebSearchInProgressEvent(event: ResponseStreamEvent): event is ResponseWebSearchCallInProgressEvent {
  return event.type === "response.web_search_call.in_progress";
}

/**
 * Checks if an event is an OpenAI web search searching event.
 * @param event - The event to validate
 * @returns True if event is ResponseWebSearchCallSearchingEvent
 */
export function isWebSearchSearchingEvent(event: ResponseStreamEvent): event is ResponseWebSearchCallSearchingEvent {
  return event.type === "response.web_search_call.searching";
}

/**
 * Checks if an event is an OpenAI web search completed event.
 * @param event - The event to validate
 * @returns True if event is ResponseWebSearchCallCompletedEvent
 */
export function isWebSearchCompletedEvent(event: ResponseStreamEvent): event is ResponseWebSearchCallCompletedEvent {
  return event.type === "response.web_search_call.completed";
}

/**
 * Checks if an event is a text delta event.
 */
export function isOutputTextDeltaEvent(ev: ResponseStreamEvent): ev is ResponseTextDeltaEvent {
  return ev.type === "response.output_text.delta";
}

/**
 * Checks if an event is an OpenAI response.output_item.added event.
 */
export function isOutputItemAddedEvent(ev: unknown): ev is ResponseOutputItemAddedEvent {
  if (!isResponseStreamEvent(ev)) {
    return false;
  }
  if ((ev as { type: string }).type !== "response.output_item.added") {
    return false;
  }
  return typeof (ev as { item?: unknown }).item === "object" && (ev as { item?: unknown }).item !== null;
}

/**
 * Checks if an event is an OpenAI response.output_item.done event.
 * Validates presence of nested item with id.
 */
export function isOutputItemDoneEvent(ev: unknown): ev is ResponseOutputItemDoneEvent {
  if (!isResponseStreamEvent(ev)) {
    return false;
  }
  if ((ev as { type: string }).type !== "response.output_item.done") {
    return false;
  }
  const o = ev as { item?: unknown };
  if (typeof o.item !== "object" || o.item === null) {
    return false;
  }
  const it = o.item as { id?: unknown };
  return typeof it.id === "string";
}

/**
 * Checks if an event is an OpenAI response.function_call_arguments.delta event.
 * Requires presence of item_id; name may not be present on delta events.
 */
export function isFunctionCallArgumentsDeltaEvent(ev: unknown): ev is ResponseFunctionCallArgumentsDeltaEvent {
  if (!isResponseStreamEvent(ev)) {
    return false;
  }
  if ((ev as { type: string }).type !== "response.function_call_arguments.delta") {
    return false;
  }
  const o = ev as { item_id?: unknown };
  return typeof o.item_id === "string";
}
