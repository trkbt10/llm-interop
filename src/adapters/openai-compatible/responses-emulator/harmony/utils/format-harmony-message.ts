/**
 * @file Format messages with Harmony special tokens.
 */

import { HARMONY_TOKENS } from "../constants";
import type { HarmonyChannel, HarmonyRole, ConstraintType } from "../constants";

export type FormatHarmonyMessageOptions = {
  role: HarmonyRole | string; // string for tool names like 'functions.get_weather'
  content: string;
  channel?: HarmonyChannel;
  recipient?: string;
  constrainType?: ConstraintType;
};

/**
 * Formats messages with Harmony special tokens and channel routing for structured LLM communication.
 * Wraps message content with appropriate Harmony tokens to enable channel-based message routing,
 * tool result handling, and recipient targeting. Essential for maintaining Harmony's structured
 * communication protocol and enabling proper message parsing by Harmony-compatible LLMs.
 *
 * @param options - Message formatting options including role, content, channel, and routing
 * @returns Harmony-formatted message string with proper token delimiters and routing information
 */
export function formatHarmonyMessage(options: FormatHarmonyMessageOptions): string {
  const { role, content, channel, recipient, constrainType } = options;

  // eslint-disable-next-line no-restricted-syntax -- Building message header requires accumulation
  let header = `${HARMONY_TOKENS.START}${role}`;

  // Add recipient in role section if it's for tool messages (e.g., "functions.get_weather to=assistant")
  if (role.includes(".") && recipient) {
    header += ` to=${recipient}`;
  }

  // Add channel if specified
  if (channel) {
    header += `${HARMONY_TOKENS.CHANNEL}${channel}`;

    // Add recipient in channel section for assistant messages
    if (!role.includes(".") && recipient) {
      header += ` to=${recipient}`;
    }
  }

  // Add constrain type for tool calls
  if (constrainType) {
    header += ` ${HARMONY_TOKENS.CONSTRAIN}${constrainType}`;
  }

  // Complete the message
  return `${header}${HARMONY_TOKENS.MESSAGE}${content}${HARMONY_TOKENS.END}`;
}

/**
 * Creates partial Harmony message headers for LLM continuation prompting.
 * Generates message headers without closing tokens to prompt LLMs to continue generating
 * content in the specified role and channel. Critical for implementing streaming responses
 * and guided content generation within Harmony workflows.
 *
 * @param role - Harmony role or tool name for the message continuation
 * @param channel - Optional channel specification for message routing
 * @returns Partial Harmony message header ready for LLM continuation
 */
export function formatPartialHarmonyMessage(role: HarmonyRole | string, channel?: HarmonyChannel): string {
  // For assistant messages that will be continued by the model
  // eslint-disable-next-line no-restricted-syntax -- Building partial message header
  let header = `${HARMONY_TOKENS.START}${role}`;

  if (channel) {
    header += `${HARMONY_TOKENS.CHANNEL}${channel}`;
  }

  // No MESSAGE or END tokens - model will continue from here
  return header;
}

/**
 * Format a tool response message
 */
export function formatToolResponseMessage(toolName: string, output: string): string {
  return formatHarmonyMessage({
    role: toolName,
    recipient: "assistant",
    channel: "commentary",
    content: output,
  });
}

/**
 * Replace stop tokens with end token for message storage
 */
export function normalizeStopTokens(content: string): string {
  if (content.endsWith(HARMONY_TOKENS.RETURN)) {
    return content.slice(0, -HARMONY_TOKENS.RETURN.length) + HARMONY_TOKENS.END;
  }
  if (content.endsWith(HARMONY_TOKENS.CALL)) {
    return content.slice(0, -HARMONY_TOKENS.CALL.length) + HARMONY_TOKENS.END;
  }
  return content;
}
