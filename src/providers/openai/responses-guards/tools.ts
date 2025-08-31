/**
 * @file Type guards for OpenAI Responses API tools
 *
 * Why: Provides type-safe runtime checks for tool-related structures
 * in the OpenAI Responses API, including function tools and tool choices.
 */

import type {
  Tool as ResponsesTool,
  FunctionTool as ResponsesFunctionTool,
  ResponseFunctionToolCall,
  ResponseFunctionToolCallOutputItem,
  ToolChoiceFunction,
  ToolChoiceOptions,
} from "openai/resources/responses/responses";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if a tool is a function tool
 */
export function isOpenAIResponsesFunctionTool(tool: ResponsesTool): tool is ResponsesFunctionTool {
  return isObject(tool) ? tool.type === "function" : false;
}

/**
 * Checks if an item is an OpenAI function call item with required properties.
 * @param item - The item to validate
 * @returns True if item is a function call with id, call_id and name
 */
export function isFunctionCallItem(item: unknown): item is ResponseFunctionToolCall & { id: string; call_id: string } {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (!("type" in item) || !("id" in item) || !("call_id" in item) || !("name" in item)) {
    return false;
  }
  const itemObj = item as { type: unknown; id: unknown; call_id: unknown; name: unknown };
  if (itemObj.type !== "function_call") {
    return false;
  }
  if (typeof itemObj.id !== "string" || typeof itemObj.call_id !== "string" || typeof itemObj.name !== "string") {
    return false;
  }
  return true;
}

/**
 * Checks if a ChatCompletionMessageToolCall is a function tool call.
 * @param toolCall - The ChatCompletionMessageToolCall to validate
 * @returns True if toolCall is a function type
 */
export const isFunctionToolCall = (
  toolCall: ChatCompletionMessageToolCall,
): toolCall is ChatCompletionMessageToolCall & { type: "function" } => {
  return toolCall.type === "function";
};

/**
 * Checks if an item is a ResponseFunctionToolCallOutputItem.
 * @param item - The item to validate
 * @returns True if item is ResponseFunctionToolCallOutputItem
 */
export const isFunctionToolCallOutput = (item: unknown): item is ResponseFunctionToolCallOutputItem => {
  if (!item) {
    return false;
  }
  if (typeof item !== "object") {
    return false;
  }
  if ((item as unknown as { type: string }).type !== "function_call_output") {
    return false;
  }
  if (!("call_id" in item)) {
    return false;
  }
  return "output" in item;
};

/**
 * Checks if a tool choice is a ToolChoiceFunction.
 * @param choice - The tool choice to validate
 * @returns True if choice is ToolChoiceFunction
 */
export const isToolChoiceFunction = (choice: unknown): choice is ToolChoiceFunction => {
  if (!choice || typeof choice !== "object") {
    return false;
  }
  const obj = choice as { type?: unknown; name?: unknown };
  if (obj.type !== "function") {
    return false;
  }
  return "name" in choice;
};

/**
 * Checks if a tool choice is ToolChoiceOptions.
 * @param choice - The tool choice to validate
 * @returns True if choice is ToolChoiceOptions
 */
export const isToolChoiceOptions = (choice: unknown): choice is ToolChoiceOptions => {
  // ToolChoiceOptions is just a string type
  return typeof choice === "string";
};

/**
 * Checks if an item is a web search call item.
 * @param item - The item to validate
 * @returns True if item is a web search call with required properties
 */
export function isWebSearchCallItem(
  item: unknown,
): item is { id: string; type: "web_search_call"; status: string; action?: { query: string } } {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (!("type" in item) || !("id" in item)) {
    return false;
  }
  const itemObj = item as { type: unknown; id: unknown };
  if (itemObj.type !== "web_search_call") {
    return false;
  }
  if (typeof itemObj.id !== "string") {
    return false;
  }
  return true;
}

/**
 * Checks if an item is an OpenAI image generation call item.
 * @param item - The item to validate
 * @returns True if item is an image generation call with required properties
 */
export function isImageGenerationCallItem(
  item: unknown,
): item is { id: string; type: "image_generation_call"; status: string; prompt?: string } {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (!("type" in item) || !("id" in item)) {
    return false;
  }
  const itemObj = item as { type: unknown; id: unknown };
  if (itemObj.type !== "image_generation_call") {
    return false;
  }
  if (typeof itemObj.id !== "string") {
    return false;
  }
  return true;
}

/**
 * Checks if an item is an OpenAI code interpreter call item.
 * @param item - The item to validate
 * @returns True if item is a code interpreter call with required properties
 */
export function isCodeInterpreterCallItem(
  item: unknown,
): item is { id: string; type: "code_interpreter_call"; status: string; code?: string; outputs?: unknown[] } {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (!("type" in item) || !("id" in item)) {
    return false;
  }
  const itemObj = item as { type: unknown; id: unknown };
  if (itemObj.type !== "code_interpreter_call") {
    return false;
  }
  if (typeof itemObj.id !== "string") {
    return false;
  }
  return true;
}

/**
 * Checks if a message has tool calls.
 * @param message - The message to validate
 * @returns True if message has non-null, non-undefined tool_calls array
 */
export const hasToolCalls = <T extends { tool_calls?: unknown }>(
  message: T,
): message is T & { tool_calls: NonNullable<T["tool_calls"]> } => {
  if (message.tool_calls === undefined || message.tool_calls === null) {
    return false;
  }
  return Array.isArray(message.tool_calls);
};