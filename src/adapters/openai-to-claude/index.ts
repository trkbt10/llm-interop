/**
 * @file Main entry point for OpenAI-to-Claude message format conversion.
 * Handles streaming and non-streaming conversions between OpenAI and Claude APIs,
 * maintaining compatibility while preserving functionality.
 */

import type { MessageStreamEvent as ClaudeStreamEvent } from "@anthropic-ai/sdk/resources/messages";
import type { ResponseStreamEvent as OpenAIResponseStreamEvent } from "openai/resources/responses/responses";
import { processOpenAIEvent } from "./event-reducer";
import type { ConversionState } from "./types";

/**
 * Converts an OpenAI streaming response to Claude streaming format.
 * Transforms event types, content blocks, and usage data while maintaining state.
 * @param openAIStream - The OpenAI event stream to convert
 * @param messageId - Unique identifier for the Claude message
 * @yields Claude-formatted streaming events
 */
export async function* openAIToClaudeStream(
  openAIStream: AsyncIterable<OpenAIResponseStreamEvent>,
  messageId: string,
): AsyncGenerator<ClaudeStreamEvent> {
  // Initialize state
  // eslint-disable-next-line no-restricted-syntax -- let is required for state reassignment
  let state: ConversionState = {
    messageId,
    contentBlocks: new Map(),
    currentIndex: 0,
    usage: { input_tokens: 0, output_tokens: 0 },
  };

  // Process OpenAI events with reducer pattern
  for await (const event of openAIStream) {
    const result = processOpenAIEvent(state, event);
    state = result.state;

    // Yield all generated Claude events
    for (const claudeEvent of result.events) {
      yield claudeEvent;
    }
  }
}

export { openAINonStreamToClaudeMessage } from "./from-nonstream";
