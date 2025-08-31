/**
 * @file Type guards for OpenAI Chat Completion response types
 *
 * Why: Provides type guards for ChatCompletion responses and related types
 * including parsed responses and token logprobs.
 */

import type {
  ChatCompletion,
  ChatCompletionTokenLogprob,
  ParsedChatCompletion,
  ParsedChoice,
  ParsedChatCompletionMessage,
  ParsedFunctionToolCall,
  ChatCompletionDeleted,
  ChatCompletionStoreMessage,
} from "openai/resources/chat/completions";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if a value is a ChatCompletion
 */
export function isChatCompletion(value: unknown): value is ChatCompletion {
  if (!isObject(value)) {
    return false;
  }
  const completion = value as Record<string, unknown>;
  if (typeof completion.id !== "string") { return false; }
  if (completion.object !== "chat.completion") { return false; }
  if (typeof completion.created !== "number") { return false; }
  if (typeof completion.model !== "string") { return false; }
  if (!Array.isArray(completion.choices)) { return false; }
  return true;
}

/**
 * Check if a value is a ChatCompletionDeleted
 */
export function isChatCompletionDeleted(value: unknown): value is ChatCompletionDeleted {
  if (!isObject(value)) {
    return false;
  }
  const deleted = value as Record<string, unknown>;
  if (typeof deleted.id !== "string") { return false; }
  if (deleted.object !== "chat.completion.deleted") { return false; }
  return deleted.deleted === true;
}

/**
 * Check if a value is a ParsedChatCompletion
 */
export function isParsedChatCompletion<T>(value: unknown): value is ParsedChatCompletion<T> {
  if (!isChatCompletion(value)) {
    return false;
  }
  const parsed = value as ParsedChatCompletion<T>;
  // Check if choices are ParsedChoice
  return parsed.choices.every(choice => isParsedChoice(choice));
}

/**
 * Check if a choice is a ParsedChoice
 */
export function isParsedChoice<T>(choice: unknown): choice is ParsedChoice<T> {
  if (!isObject(choice)) {
    return false;
  }
  const parsedChoice = choice as Record<string, unknown>;
  if (typeof parsedChoice.index !== "number") { return false; }
  if (!isObject(parsedChoice.message)) { return false; }
  return isParsedMessage(parsedChoice.message);
}

/**
 * Check if a message is a ParsedChatCompletionMessage
 */
export function isParsedMessage<T>(message: unknown): message is ParsedChatCompletionMessage<T> {
  if (!isObject(message)) {
    return false;
  }
  const parsedMsg = message as Record<string, unknown>;
  // Has parsed field or parsed_tool_calls
  return "parsed" in parsedMsg || "parsed_tool_calls" in parsedMsg;
}

/**
 * Check if a tool call is a ParsedFunctionToolCall
 */
export function isParsedFunctionToolCall(toolCall: unknown): toolCall is ParsedFunctionToolCall {
  if (!isObject(toolCall)) {
    return false;
  }
  const parsed = toolCall as Record<string, unknown>;
  if (parsed.type !== "function") { return false; }
  if (!isObject(parsed.function)) { return false; }
  return "parsed_arguments" in (parsed.function as Record<string, unknown>);
}

/**
 * Check if a value is a ChatCompletionTokenLogprob
 */
export function isChatCompletionTokenLogprob(value: unknown): value is ChatCompletionTokenLogprob {
  if (!isObject(value)) {
    return false;
  }
  const logprob = value as Record<string, unknown>;
  if (typeof logprob.token !== "string") { return false; }
  if (typeof logprob.logprob !== "number") { return false; }
  if (!Array.isArray(logprob.bytes)) { return false; }
  if (!Array.isArray(logprob.top_logprobs)) { return false; }
  return true;
}

/**
 * Check if a value is a ChatCompletionStoreMessage
 */
export function isChatCompletionStoreMessage(value: unknown): value is ChatCompletionStoreMessage {
  if (!isObject(value)) {
    return false;
  }
  const msg = value as Record<string, unknown>;
  // Must have id and metadata in addition to regular message fields
  if (typeof msg.id !== "string") { return false; }
  if (!isObject(msg.metadata)) { return false; }
  return typeof msg.role === "string";
}

/**
 * Check if a completion has usage information
 */
export function hasCompletionUsage(completion: ChatCompletion): boolean {
  return completion.usage !== null && completion.usage !== undefined;
}

/**
 * Check if a completion has system fingerprint
 */
export function hasSystemFingerprint(completion: ChatCompletion): boolean {
  return completion.system_fingerprint !== null && completion.system_fingerprint !== undefined;
}

/**
 * Check if a completion has service tier
 */
export function hasCompletionServiceTier(completion: ChatCompletion): boolean {
  return completion.service_tier !== null && completion.service_tier !== undefined;
}

/**
 * Check if all choices in completion have finish reason
 */
export function isCompleteResponse(completion: ChatCompletion): boolean {
  for (const choice of completion.choices) {
    if (choice.finish_reason === null) {
      return false;
    }
  }
  return true;
}

/**
 * Check if completion has refusal in any choice
 */
export function hasRefusalInCompletion(completion: ChatCompletion): boolean {
  for (const choice of completion.choices) {
    if (choice.message.refusal !== null && choice.message.refusal !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Get finish reasons from completion
 */
export function getCompletionFinishReasons(completion: ChatCompletion): (string | null)[] {
  const arr: (string | null)[] = [];
  for (const choice of completion.choices) {
    arr.push(choice.finish_reason);
  }
  return arr;
}

/**
 * Extract messages from completion choices
 */
export function extractMessages(completion: ChatCompletion): ChatCompletion["choices"][0]["message"][] {
  const arr: ChatCompletion["choices"][0]["message"][] = [];
  for (const choice of completion.choices) {
    arr.push(choice.message);
  }
  return arr;
}
