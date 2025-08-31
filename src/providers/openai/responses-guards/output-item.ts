/**
 * @file Type guards for OpenAI Responses API output items
 *
 * Why: Provides type-safe runtime checks for different types of output items
 * including messages, function calls, and response validation.
 */

import type {
  Response as OpenAIResponse,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseOutputText,
  ResponseFunctionToolCall,
  ResponseItem,
} from "openai/resources/responses/responses";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if a value is an OpenAI Response
 */
export function isOpenAIResponse(v: unknown): v is OpenAIResponse {
  return isObject(v) ? (v as { object?: unknown }).object === "response" : false;
}

/**
 * Check if a response contains a function call
 */
export function responseHasFunctionCall(resp: OpenAIResponse): boolean {
  const out = (resp as { output?: unknown }).output;
  if (!Array.isArray(out)) {
    return false;
  }
  return out.some((i) => (isObject(i) ? (i as { type?: unknown }).type === "function_call" : false));
}

// Type guards for ResponseOutputItem variants
/**
 * Checks if a ResponseOutputItem is a function tool call.
 * @param item - The ResponseOutputItem to validate
 * @returns True if item is ResponseFunctionToolCall
 */
export function isResponseFunctionToolCall(item: ResponseOutputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

/**
 * Checks if a ResponseOutputItem is an output message.
 * @param item - The ResponseOutputItem to validate
 * @returns True if item is ResponseOutputMessage
 */
export function isResponseOutputMessage(item: ResponseOutputItem): item is ResponseOutputMessage {
  return item.type === "message";
}

/**
 * Checks if a ResponseOutputItem is a message output (alternative name).
 * @param output - The ResponseOutputItem to validate
 * @returns True if output is ResponseOutputMessage
 */
export const isMessageOutput = (output: ResponseOutputItem): output is ResponseOutputMessage => {
  if (output.type !== "message") {
    return false;
  }
  return "content" in output;
};

/**
 * Checks if a ResponseOutputItem is a function call output (alternative name).
 * @param output - The ResponseOutputItem to validate
 * @returns True if output is ResponseFunctionToolCall
 */
export const isFunctionCallOutput = (output: ResponseOutputItem): output is ResponseFunctionToolCall => {
  if (output.type !== "function_call") {
    return false;
  }
  if (!("id" in output)) {
    return false;
  }
  return "name" in output;
};

/**
 * Checks if a content part is an output_text.
 * @param part - The content part to validate
 * @returns True if part is ResponseOutputText
 */
export function isResponseOutputText(part: unknown): part is ResponseOutputText {
  if (typeof part !== "object" || part === null) {
    return false;
  }
  const obj = part as { type?: unknown };
  return obj.type === "output_text";
}

/**
 * Checks if a message has content.
 * @param message - The message to validate
 * @returns True if message has non-null, non-undefined content
 */
export const hasContent = <T extends { content: unknown }>(
  message: T,
): message is T & { content: NonNullable<T["content"]> } => {
  if (message.content === null) {
    return false;
  }
  return message.content !== undefined;
};

/**
 * Checks if a ResponseOutputItem is compatible with ResponseItem.
 * @param output - The ResponseOutputItem to validate
 * @returns True if output type exists in both unions
 */
export const isResponseItemCompatible = (output: ResponseOutputItem): output is ResponseOutputItem & ResponseItem => {
  // Check if the output item type exists in both ResponseOutputItem and ResponseItem unions
  switch (output.type) {
    case "message":
    case "file_search_call":
    case "computer_call":
    case "web_search_call":
    case "reasoning":
    case "code_interpreter_call":
      return true;
    case "function_call":
      // ResponseFunctionToolCall needs id to be compatible with ResponseFunctionToolCallItem
      return false;
    default:
      // For namespace types like image_generation_call
      return true;
  }
};
