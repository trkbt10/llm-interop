/**
 * @file Streaming converter for Harmony to Responses API.
 *
 * Provides real-time streaming conversion of Harmony responses.
 */

import { HARMONY_CHANNELS } from "../constants";
import { createHarmonyStreamParser } from "./stream-parser";
import type { HarmonyStreamParser } from "./stream-parser";
import { HarmonyResponsesEventBuilder } from "./converter";
import type { HarmonyToResponsesOptions } from "./types";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

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
  const builder = new HarmonyResponsesEventBuilder(resolvedOptions);

  yield builder.start();

  for await (const chunk of chunks) {
    const frames = parser.push(chunk);
    yield* emitFrames(builder, frames);
  }

  const trailingFrames = parser.flush();
  yield* emitFrames(builder, trailingFrames);

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
