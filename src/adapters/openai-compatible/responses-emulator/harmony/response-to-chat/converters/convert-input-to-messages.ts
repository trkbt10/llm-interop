/**
 * @file Convert Response API input to ChatCompletion messages.
 */

import type { ResponseInput, ChatCompletionMessageParam } from "../../types";
import { formatHarmonyMessage } from "../../utils/format-harmony-message";
import { isObject, isResponseInputToolCall, isMessageInput, isTextContentPart } from "../../utils/type-guards";

/**
 * Transforms Response API input into Chat Completion message format for Harmony processing.
 * Handles the structural conversion from Response API's flexible input types to the
 * standardized Chat Completion message array, enabling Response API workflows to leverage
 * Chat Completion processing pipelines and Harmony's message formatting capabilities.
 *
 * @param input - Response API input in string or structured array format
 * @returns Chat Completion message array with Harmony-formatted content
 */
export function convertInputToMessages(input?: string | ResponseInput): ChatCompletionMessageParam[] {
  if (!input) {
    return [];
  }

  // Handle simple string input
  if (typeof input === "string") {
    const harmonyMessage = formatHarmonyMessage({
      role: "user",
      content: input,
    });
    return [
      {
        role: "user",
        content: harmonyMessage,
      },
    ];
  }

  // Handle ResponseInput array
  if (!Array.isArray(input)) {
    return [];
  }

  const messages: ChatCompletionMessageParam[] = [];

  for (const item of input) {
    if (!isObject(item)) {
      continue;
    }

    // Handle message items
    if (isMessageInput(item)) {
      const harmonyContent = formatHarmonyMessage({
        role: item.role,
        content: extractMessageContent(item),
      });

      messages.push({
        role: mapRole(item.role),
        content: harmonyContent,
      });
      continue;
    }

    // Handle tool calls and outputs
    if (isResponseInputToolCall(item)) {
      // Tool calls are typically handled in conversation state
      // For now, we'll skip them in basic input conversion
      continue;
    }

    // Skip any other unhandled input types
    // ResponseInputText is not part of ResponseInputItem in the OpenAI types
  }

  return messages;
}

function extractMessageContent(message: { content: string | Array<{ type: string; text?: string }> }): string {
  // Extract content from message
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    // Concatenate text parts
    return message.content
      .filter(isTextContentPart)
      .map((part) => part.text)
      .join("\n");
  }

  return "";
}

function mapRole(role: string): "system" | "user" | "assistant" {
  switch (role) {
    case "system":
      return "system";
    case "developer":
      return "system"; // Developer messages map to system in ChatCompletion
    case "user":
      return "user";
    case "assistant":
      return "assistant";
    default:
      return "user"; // Default to user for unknown roles
  }
}
