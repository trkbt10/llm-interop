/**
 * @file Type guards for OpenAI Chat Completion message types
 *
 * Why: Provides comprehensive type guards for all message-related types
 * in the Chat Completions API, including message params and responses.
 */

import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionFunctionMessageParam,
  ChatCompletionDeveloperMessageParam,
  ChatCompletionRole,
  ChatCompletionMessageToolCall,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageCustomToolCall,
} from "openai/resources/chat/completions";

/**
 * Check if a role is a valid ChatCompletionRole
 */
export function isChatCompletionRole(role: unknown): role is ChatCompletionRole {
  return (
    role === "developer" ||
    role === "system" ||
    role === "user" ||
    role === "assistant" ||
    role === "tool" ||
    role === "function"
  );
}

/**
 * Check if a role is a basic chat role (user, assistant, system)
 */
export function isOpenAIChatBasicRole(role: unknown): role is "user" | "assistant" | "system" {
  return role === "user" || role === "assistant" || role === "system";
}

/**
 * Check if a message param is a system message
 */
export function isSystemMessageParam(
  message: ChatCompletionMessageParam
): message is ChatCompletionSystemMessageParam {
  return message.role === "system";
}

/**
 * Check if a message param is a user message
 */
export function isUserMessageParam(
  message: ChatCompletionMessageParam
): message is ChatCompletionUserMessageParam {
  return message.role === "user";
}

/**
 * Check if a message param is an assistant message
 */
export function isAssistantMessageParam(
  message: ChatCompletionMessageParam
): message is ChatCompletionAssistantMessageParam {
  return message.role === "assistant";
}

/**
 * Check if a message param is a tool message
 */
export function isToolMessageParam(
  message: ChatCompletionMessageParam
): message is ChatCompletionToolMessageParam {
  return message.role === "tool";
}

/**
 * Check if a message param is a function message
 */
export function isFunctionMessageParam(
  message: ChatCompletionMessageParam
): message is ChatCompletionFunctionMessageParam {
  return message.role === "function";
}

/**
 * Check if a message param is a developer message
 */
export function isDeveloperMessageParam(
  message: ChatCompletionMessageParam
): message is ChatCompletionDeveloperMessageParam {
  return message.role === "developer";
}

/**
 * Check if a value is a ChatCompletionMessage
 */
export function isChatCompletionMessage(value: unknown): value is ChatCompletionMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const msg = value as Record<string, unknown>;
  if (typeof msg.role !== "string") {
    return false;
  }
  return isChatCompletionRole(msg.role);
}

/**
 * Check if a message has refusal content
 */
export function hasRefusal(message: ChatCompletionMessage): boolean {
  if (message.refusal === null || message.refusal === undefined) {
    return false;
  }
  return true;
}

/**
 * Check if a message has tool calls
 */
export function hasToolCalls(
  message: ChatCompletionMessage
): message is ChatCompletionMessage & { tool_calls: NonNullable<ChatCompletionMessage["tool_calls"]> } {
  if (message.tool_calls === null || message.tool_calls === undefined) {
    return false;
  }
  return Array.isArray(message.tool_calls);
}

/**
 * Check if a message has function call (deprecated)
 */
export function hasFunctionCall(
  message: ChatCompletionMessage
): message is ChatCompletionMessage & { function_call: NonNullable<ChatCompletionMessage["function_call"]> } {
  if (message.function_call === null || message.function_call === undefined) {
    return false;
  }
  return true;
}

/**
 * Check if a tool call is a function tool call
 */
export function isFunctionToolCall(
  toolCall: ChatCompletionMessageToolCall
): toolCall is ChatCompletionMessageFunctionToolCall {
  return toolCall.type === "function";
}

/**
 * Check if a tool call is a custom tool call
 */
export function isCustomToolCall(
  toolCall: ChatCompletionMessageToolCall
): toolCall is ChatCompletionMessageCustomToolCall {
  return toolCall.type === "custom";
}

/**
 * Check if a message has audio content
 */
export function hasAudio(
  message: ChatCompletionMessage
): message is ChatCompletionMessage & { audio: NonNullable<ChatCompletionMessage["audio"]> } {
  if (message.audio === null || message.audio === undefined) {
    return false;
  }
  return true;
}

/**
 * Check if a message has content
 */
export function hasContent(
  message: ChatCompletionMessage
): message is ChatCompletionMessage & { content: NonNullable<ChatCompletionMessage["content"]> } {
  if (message.content === null || message.content === undefined) {
    return false;
  }
  return true;
}
