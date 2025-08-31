/**
 * @file Type definitions for Harmony to Responses API conversion.
 */

import type { ResponseStreamEvent } from "openai/resources/responses/responses";

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
export type HarmonyToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};
export type HarmonyMessage = {
  role: string;
  content: string;
  channel?: "analysis" | "commentary" | "final";
  recipient?: string;
  constrainType?: string;
  reasoning?: string;
  tool_calls?: HarmonyToolCall[];
};
export type HarmonyParsedToolCall = {
  id: string;
  name: string;
  arguments: string;
};
export type ParsedHarmonyResponse = {
  messages: ParsedHarmonyMessage[];
  reasoning?: string;
  toolCalls?: HarmonyParsedToolCall[];
};

export type ParsedHarmonyMessage = {
  channel: "analysis" | "commentary" | "final";
  content: string;
  recipient?: string;
  constrainType?: string;
  isToolCall?: boolean;
};

export type HarmonyParserState = {
  currentMessage?: Partial<ParsedHarmonyMessage>;
  messages: ParsedHarmonyMessage[];
  inMessage: boolean;
  currentRole?: string;
  buffer: string;
  expectingContent: boolean;
};

export type HarmonyResponseEvent = ResponseStreamEvent;
