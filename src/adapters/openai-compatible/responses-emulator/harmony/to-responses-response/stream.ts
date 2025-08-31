/**
 * @file Streaming converter for Harmony to Responses API.
 *
 * Provides real-time streaming conversion of Harmony responses
 */

import { convertHarmonyToResponses } from "./converter";
import type { HarmonyToResponsesOptions } from "./types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

/**
 * Creates a streaming converter that transforms Harmony response chunks into Response API events.
 * Enables real-time processing of Harmony formatted responses, parsing channel-based content
 * and converting it into OpenAI Response API stream events. Essential for maintaining streaming
 * responsiveness while bridging Harmony and Response API formats.
 *
 * @param chunks - Async iterable of Harmony response string chunks
 * @param options - Conversion options for controlling output format and behavior
 * @yields Response API stream events representing parsed Harmony content
 */
export async function* createHarmonyToResponsesStream(
  chunks: AsyncIterable<string>,
  options: HarmonyToResponsesOptions = {},
): AsyncGenerator<ResponseStreamEvent, void, unknown> {
  // Stream mode is always enabled for streaming

  // eslint-disable-next-line no-restricted-syntax -- Streaming buffer requires accumulation
  let buffer = "";
  // eslint-disable-next-line no-restricted-syntax -- State tracking for stream parsing
  let harmonyStarted = false;

  for await (const chunk of chunks) {
    buffer += chunk;

    // Wait for complete Harmony response
    if (!harmonyStarted && buffer.includes("<|start|>")) {
      harmonyStarted = true;
    }

    if (harmonyStarted && buffer.includes("<|end|>")) {
      // Parse and convert the complete response
      const harmonyMessage = {
        role: "assistant",
        content: buffer,
      };

      const events = await convertHarmonyToResponses(harmonyMessage, { ...options, stream: true });

      // Yield all events
      for (const event of events) {
        yield event;
      }

      // Reset for potential next response
      buffer = "";
      harmonyStarted = false;
    }
  }

  // Handle any remaining content
  if (buffer.trim()) {
    const harmonyMessage = {
      role: "assistant",
      content: buffer,
    };

    const events = await convertHarmonyToResponses(harmonyMessage, { ...options, stream: true });

    for (const event of events) {
      yield event;
    }
  }
}
