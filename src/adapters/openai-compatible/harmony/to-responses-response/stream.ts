/**
 * @file Streaming converter for Harmony to Responses API.
 *
 * Provides real-time streaming conversion of Harmony responses.
 */

import { HARMONY_CHANNELS } from "../constants";
import { createHarmonyStreamParser } from "./stream-parser";
import type { HarmonyStreamParser } from "./stream-parser";
import { createHarmonyResponsesEventBuilder, type HarmonyResponsesEventBuilder } from "./converter";
import type { HarmonyToResponsesOptions } from "./types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

/**
 * Converts Harmony response chunks into OpenAI Responses stream events.
 */
export async function* createHarmonyToResponsesStream(
  chunks: AsyncIterable<string>,
  options: HarmonyToResponsesOptions = {},
): AsyncGenerator<ResponseStreamEvent, void, unknown> {
  const resolvedOptions = {
    stream: true,
    ...options,
  } satisfies HarmonyToResponsesOptions & { stream: boolean };

  const parser = createHarmonyStreamParser();
  const builder = createHarmonyResponsesEventBuilder(resolvedOptions);

  yield builder.start();

  // eslint-disable-next-line no-restricted-syntax -- Need mutable state to track channel across async iterations
  let lastChannel: string | null = null;

  for await (const chunk of chunks) {
    const frames = parser.push(chunk);
    for (const event of emitFrames(builder, frames, { lastChannel }, (channel) => { lastChannel = channel; })) {
      yield event;
    }
  }

  const trailingFrames = parser.flush();
  for (const event of emitFrames(builder, trailingFrames, { lastChannel }, (channel) => { lastChannel = channel; })) {
    yield event;
  }

  for (const event of builder.finish()) {
    yield event;
  }
}

function* emitFrames(
  builder: HarmonyResponsesEventBuilder,
  frames: ReturnType<HarmonyStreamParser["push"]>,
  state: { lastChannel: string | null },
  updateChannel: (channel: string) => void,
): Generator<ResponseStreamEvent, void, undefined> {
  for (const frame of frames) {
    const { message, toolCall } = frame;

    // If we're transitioning from ANALYSIS to something else, finish reasoning
    if (state.lastChannel === HARMONY_CHANNELS.ANALYSIS &&
        message.channel !== HARMONY_CHANNELS.ANALYSIS) {
      yield* builder.finishReasoning();
    }

    if (message.channel === HARMONY_CHANNELS.ANALYSIS) {
      yield* builder.appendReasoning(message.content);
      updateChannel(HARMONY_CHANNELS.ANALYSIS);
      continue;
    }

    if (message.isToolCall && toolCall) {
      yield* builder.appendToolCall(toolCall);
      continue;
    }

    if (message.channel === HARMONY_CHANNELS.FINAL) {
      yield* builder.appendFinal(message.content);
      updateChannel(HARMONY_CHANNELS.FINAL);
    }
  }
}
