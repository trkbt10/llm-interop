/**
 * @file Harmony to Responses API Converter.
 *
 * Converts parsed Harmony messages to OpenAI Responses API events
 */

import { HARMONY_CHANNELS } from "../constants";
import type { HarmonyMessage } from "../types";
import { parseHarmonyResponse } from "./parse-response";
import type { HarmonyToResponsesOptions } from "./types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { createHarmonyResponsesEventBuilder } from "./converter-blocks/builder";
import type { HarmonyResponsesEventBuilder } from "./converter-blocks/builder";

export const convertHarmonyToResponses = async (
  response: HarmonyMessage,
  options: HarmonyToResponsesOptions = {},
): Promise<ResponseStreamEvent[]> => {
  const parsed = await parseHarmonyResponse(response);
  const resolvedOptions = {
    stream: false,
    ...options,
  } satisfies HarmonyToResponsesOptions & { stream: boolean };

  const builder = createHarmonyResponsesEventBuilder(resolvedOptions);
  const events: ResponseStreamEvent[] = [];

  events.push(builder.start());

  // Handle analysis/reasoning content from parsed messages
  const analysisMessages = parsed.messages.filter((m) => m.channel === HARMONY_CHANNELS.ANALYSIS);
  for (const message of analysisMessages) {
    events.push(...builder.appendReasoning(message.content));
  }

  // If we have explicit reasoning and no analysis messages were found, add the reasoning
  // This is separate from final content - reasoning should be included when explicitly provided
  if (parsed.reasoning && analysisMessages.length === 0) {
    events.push(...builder.appendReasoning(parsed.reasoning));
  }

  // Finish reasoning before moving to tool calls or final content
  const hasAnalysisMessages = analysisMessages.length > 0;
  const hasExplicitReasoningOnly = parsed.reasoning ? analysisMessages.length === 0 : false;
  const hasReasoning = hasAnalysisMessages ? true : hasExplicitReasoningOnly;
  if (hasReasoning) {
    events.push(...builder.finishReasoning());
  }

  // Handle tool calls
  if (parsed.toolCalls) {
    for (const toolCall of parsed.toolCalls) {
      events.push(...builder.appendToolCall(toolCall));
    }
  }

  // Handle final/output content
  const finalMessages = parsed.messages.filter((m) => m.channel === HARMONY_CHANNELS.FINAL);
  for (const message of finalMessages) {
    events.push(...builder.appendFinal(message.content));
  }

  events.push(...builder.finish());

  return events;
};

export const createHarmonyToResponsesConverter = (options: HarmonyToResponsesOptions = {}) => {
  return {
    convert: (response: HarmonyMessage) => convertHarmonyToResponses(response, options),
  };
};

// Re-export builder for external use if needed
export { createHarmonyResponsesEventBuilder, type HarmonyResponsesEventBuilder };