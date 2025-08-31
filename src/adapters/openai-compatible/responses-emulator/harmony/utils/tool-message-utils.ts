/**
 * @file Utilities for handling tool messages in Harmony format.
 */

import { HARMONY_CHANNELS, FUNCTION_NAMESPACE, BUILTIN_TOOLS, CONSTRAINT_TYPES } from "../constants";
import type { HarmonyChannel, ConstraintType } from "../constants";
import { formatHarmonyMessage, formatToolResponseMessage } from "./format-harmony-message";

export type ToolCallInfo = {
  toolName: string;
  namespace: string;
  functionName: string;
  channel: HarmonyChannel;
  constraintType?: ConstraintType;
};

/**
 * Parse a tool recipient string (e.g., "functions.get_weather" or "browser.search")
 */
export function parseToolRecipient(recipient: string): ToolCallInfo | undefined {
  const parts = recipient.split(".");
  if (parts.length !== 2) {
    return undefined;
  }

  const [namespace, functionName] = parts;

  // Determine channel based on namespace
  // eslint-disable-next-line no-restricted-syntax -- Channel assignment requires branching logic
  let channel: HarmonyChannel;
  if (namespace === FUNCTION_NAMESPACE) {
    channel = HARMONY_CHANNELS.COMMENTARY;

    return {
      toolName: recipient,
      namespace,
      functionName,
      channel,
      constraintType: namespace === FUNCTION_NAMESPACE ? CONSTRAINT_TYPES.JSON : undefined,
    };
  }

  if (namespace === BUILTIN_TOOLS.BROWSER || namespace === BUILTIN_TOOLS.PYTHON) {
    channel = HARMONY_CHANNELS.ANALYSIS;

    return {
      toolName: recipient,
      namespace,
      functionName,
      channel,
      constraintType: undefined,
    };
  }

  // Default to commentary for unknown tools
  channel = HARMONY_CHANNELS.COMMENTARY;

  return {
    toolName: recipient,
    namespace,
    functionName,
    channel,
    constraintType: undefined,
  };
}

/**
 * Format a tool call message
 */
export function formatToolCallMessage(
  toolName: string,
  args: string | object,
  constraintType?: ConstraintType,
): string {
  const toolInfo = parseToolRecipient(toolName);
  if (!toolInfo) {
    throw new Error(`Invalid tool name: ${toolName}`);
  }

  const content = typeof args === "string" ? args : JSON.stringify(args);

  return formatHarmonyMessage({
    role: "assistant",
    channel: toolInfo.channel,
    recipient: toolName,
    constrainType: constraintType ?? toolInfo.constraintType,
    content,
  });
}

/**
 * Format a tool response
 */
export function formatToolResponse(toolName: string, output: string | object): string {
  const content = typeof output === "string" ? output : JSON.stringify(output);
  return formatToolResponseMessage(toolName, content);
}

/**
 * Check if a message contains a tool call
 */
export function isToolCallMessage(message: string): boolean {
  if (!message.includes(" to=")) {
    return false;
  }
  if (message.includes(`to=${FUNCTION_NAMESPACE}.`)) {
    return true;
  }
  if (message.includes(`to=${BUILTIN_TOOLS.BROWSER}.`)) {
    return true;
  }
  if (message.includes(`to=${BUILTIN_TOOLS.PYTHON}`)) {
    return true;
  }
  return false;
}

/**
 * Extract tool information from a message
 */
export function extractToolInfoFromMessage(message: string): ToolCallInfo | undefined {
  const toMatch = message.match(/to=(\w+\.\w+)/);
  if (!toMatch) {
    return undefined;
  }

  return parseToolRecipient(toMatch[1]);
}
