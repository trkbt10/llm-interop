/**
 * @file Type definitions for OpenAI to Claude message conversion state management.
 * Defines the data structures used in the reducer pattern for handling streaming message conversion.
 * These types support the stateful transformation needed to bridge OpenAI's delta-based streaming
 * format with Claude's structured content block system.
 */
import type { MessageStreamEvent as ClaudeStreamEvent } from "@anthropic-ai/sdk/resources/messages";

// State for reducer pattern
export type ConversionState = {
  messageId: string;
  contentBlocks: Map<string, ContentBlockState>;
  currentTextBlockId?: string;
  currentIndex: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

export type ContentBlockState = {
  index: number;
  type: "text" | "tool_use";
  id: string;
  name?: string;
  content: string;
  started: boolean;
  completed: boolean;
};

// Actions for reducer
export type ConversionAction =
  | { type: "ADD_TEXT_BLOCK"; id: string }
  | { type: "ADD_TOOL_BLOCK"; id: string; claudeId: string; name: string }
  | { type: "UPDATE_TEXT"; id: string; delta: string }
  | { type: "UPDATE_TOOL_ARGS"; id: string; delta: string }
  | { type: "MARK_STARTED"; id: string }
  | { type: "MARK_COMPLETED"; id: string }
  | { type: "SET_CURRENT_TEXT_BLOCK"; id?: string }
  | { type: "UPDATE_USAGE"; input?: number; output?: number };

// Event processing result
export type ProcessEventResult = {
  state: ConversionState;
  events: ClaudeStreamEvent[];
};
