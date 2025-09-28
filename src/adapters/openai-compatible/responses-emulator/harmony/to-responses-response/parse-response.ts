/**
 * @file Parse Harmony-formatted assistant output into structured Responses data.
 */
import { HARMONY_CHANNELS } from "../constants";
import type { HarmonyMessage } from "../types";
import type { HarmonyParsedToolCall, ParsedHarmonyMessage, ParsedHarmonyResponse } from "./types";
import {
  createHarmonyParseError,
  containsHarmonySyntax,
  createHarmonyStreamParser,
  isHarmonyParseError,
  normalizeToolCalls,
} from "./stream-parser";

export const parseHarmonyResponse = async (response: HarmonyMessage): Promise<ParsedHarmonyResponse> => {
  const messages: ParsedHarmonyMessage[] = [];
  const parsedToolCalls: HarmonyParsedToolCall[] = [];

  const content = response.content ?? "";
  const reasoningFromResponse = response.reasoning;
  const reasoningParts: string[] = [];

  if (!content) {
    return finalizeResult({ messages, reasoningFromResponse, parsedToolCalls, toolCallsField: response.tool_calls });
  }

  if (!containsHarmonySyntax(content)) {
    messages.push({
      channel: HARMONY_CHANNELS.FINAL,
      content,
      isToolCall: false,
      stopReason: "return",
      role: response.role,
    });

    return finalizeResult({ messages, reasoningFromResponse, parsedToolCalls, toolCallsField: response.tool_calls });
  }

  const streamParser = createHarmonyStreamParser();

  const frames = (() => {
    try {
      return [...streamParser.push(content), ...streamParser.flush()];
    } catch (error) {
      if (isHarmonyParseError(error)) {
        throw error;
      }
      throw createHarmonyParseError("Failed to parse harmony response", { error: String(error) });
    }
  })();

  for (const frame of frames) {
    messages.push(frame.message);
    if (!reasoningFromResponse && frame.message.channel === HARMONY_CHANNELS.ANALYSIS) {
      if (frame.message.content) {
        reasoningParts.push(frame.message.content);
      }
    }
    if (!response.tool_calls && frame.toolCall) {
      parsedToolCalls.push(frame.toolCall);
    }
  }

  if (messages.length === 0) {
    throw createHarmonyParseError("Harmony response yielded no messages");
  }

  return finalizeResult({
    messages,
    reasoningFromResponse,
    parsedToolCalls,
    toolCallsField: response.tool_calls,
    reasoningParts,
  });
};

const finalizeResult = ({
  messages,
  reasoningFromResponse,
  parsedToolCalls,
  reasoningParts = [],
  toolCallsField,
}: {
  messages: ParsedHarmonyMessage[];
  reasoningFromResponse?: string;
  parsedToolCalls: HarmonyParsedToolCall[];
  reasoningParts?: string[];
  toolCallsField?: HarmonyMessage["tool_calls"];
}): ParsedHarmonyResponse => {
  const normalizedToolCalls = normalizeToolCalls(toolCallsField);
  const toolCalls = normalizedToolCalls ?? (parsedToolCalls.length > 0 ? parsedToolCalls : undefined);

  const reasoning = reasoningFromResponse ?? (reasoningParts.length > 0 ? reasoningParts.join("\n\n") : undefined);

  return {
    messages,
    reasoning,
    toolCalls,
  };
};
