/**
 * @file Normalize ChatCompletion tool calls to Harmony tool call format.
 *
 * This belongs in the Harmony → Responses conversion layer because it bridges
 * OpenAI's Chat Completions output (which exposes tool calls via structured
 * metadata) with the Harmony parser that expects tool call data in the
 * Harmony message object. When the upstream pipeline routes through the chat
 * endpoint instead of the Responses API, this mapper ensures we still recover
 * consistent Harmony tool call structures for downstream event conversion.
 */

import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import type { HarmonyToolCall } from "../types";
import { isFunctionToolCall } from "../../../../providers/openai/responses-guards";

/**
 * Converts OpenAI ChatCompletion tool call objects into Harmony-compatible tool call records.
 * This is only concerned with ChatCompletion payloads; Responses-native tool
 * calls bypass this path entirely because they are already normalized when
 * emitted as Harmony.
 */
export function mapChatToolCallsToHarmony(
  toolCalls: ChatCompletionMessageToolCall[] | undefined,
): HarmonyToolCall[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  const normalized: HarmonyToolCall[] = [];
  toolCalls.forEach((toolCall, index) => {
    if (!isFunctionToolCall(toolCall)) {
      return;
    }
    const name = toolCall.function?.name;
    if (!name) {
      return;
    }
    normalized.push({
      id: toolCall.id ?? `tool_call_${index}`,
      type: "function",
      function: {
        name,
        arguments: toolCall.function.arguments ?? "",
      },
    });
  });

  return normalized;
}
