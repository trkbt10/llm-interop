/**
 * @file Type definitions for Harmony to Responses API conversion.
 */

import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { HarmonyChannel as HarmonyChannelType } from "../constants";

export type HarmonyToResponsesOptions = {
  /** Request ID for the response */
  requestId?: string;
  /** Model name */
  model?: string;
  /** Whether to emit streaming events */
  stream?: boolean;
  /** Prefix for generated IDs */
  idPrefix?: string;
};
export type HarmonyParsedToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type HarmonyStopReason = "end" | "call" | "return";

export type ParsedHarmonyMessage = {
  channel: HarmonyChannelType;
  content: string;
  recipient?: string;
  constrainType?: string;
  isToolCall: boolean;
  stopReason: HarmonyStopReason;
  role?: string;
};

export type ParsedHarmonyResponse = {
  messages: ParsedHarmonyMessage[];
  reasoning?: string;
  toolCalls?: HarmonyParsedToolCall[];
};

export type HarmonyParserFrame = {
  type: "message";
  message: ParsedHarmonyMessage;
  toolCall?: HarmonyParsedToolCall;
};

export type HarmonyResponseEvent = ResponseStreamEvent;
