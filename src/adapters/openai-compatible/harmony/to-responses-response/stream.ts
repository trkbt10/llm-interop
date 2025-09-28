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
    idPrefix: "harmony",
    stream: true,
    ...options,
  } satisfies HarmonyToResponsesOptions & { idPrefix: string; stream: boolean };

  const parser = createHarmonyStreamParser();
  const builder = createHarmonyResponsesEventBuilder(resolvedOptions);

  yield builder.start();

  for await (const chunk of chunks) {
    const frames = parser.push(chunk);
    for (const event of emitFrames(builder, frames)) {
      yield event;
    }
  }

  const trailingFrames = parser.flush();
  for (const event of emitFrames(builder, trailingFrames)) {
    yield event;
  }

  for (const event of builder.finish()) {
    yield event;
  }
}

function* emitFrames(
  builder: HarmonyResponsesEventBuilder,
  frames: ReturnType<HarmonyStreamParser["push"]>,
): Generator<ResponseStreamEvent, void, undefined> {
  for (const frame of frames) {
    const { message, toolCall } = frame;

    if (message.channel === HARMONY_CHANNELS.ANALYSIS) {
      yield* builder.appendReasoning(message.content);
      continue;
    }

    if (message.isToolCall && toolCall) {
      yield* builder.appendToolCall(toolCall);
      continue;
    }

    if (message.channel === HARMONY_CHANNELS.FINAL) {
      yield* builder.appendFinal(message.content);
    }
  }
}
