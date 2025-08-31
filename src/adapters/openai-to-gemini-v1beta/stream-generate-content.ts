/**
 * @file streamGenerateContent implementation for OpenAI → Gemini v1beta adapter
 */
import type { OpenAICompatibleClient, ResponseCreateParamsStreaming } from "../openai-client-types";
import type { GeminiRequest, GeminiStreamChunk } from "./core/gemini-types";
import { buildStreamingParams } from "./core/request-mapper";
import { ensureOpenAIResponseStream } from "../../providers/openai/responses-guards/stream-event";
import { createInitialState, processOpenAIEventToGemini } from "./event-reducer";

/**
 * Emulate v1beta streamGenerateContent using the Responses streaming API and map deltas to v1beta chunks.
 */
export async function streamGenerateContent(
  client: OpenAICompatibleClient,
  model: string,
  body: GeminiRequest,
  options?: { signal?: AbortSignal },
): Promise<AsyncIterable<GeminiStreamChunk>> {
  const params: ResponseCreateParamsStreaming = buildStreamingParams(model, body);
  const stream = await client.responses.create(params, options);
  const state = createInitialState({
    onError: ({ code, message, snippet }) => {
      const formatted = `[v1beta reducer] ${code}: ${message}${snippet ? ` | ${snippet}` : ""}`;
      const isNode = typeof process !== "undefined" && typeof process.env !== "undefined";
      const strict = isNode ? process.env.GEMINI_V1BETA_STRICT === "1" : false;
      if (strict) {
        // Fail fast in strict mode (e.g., CI) to avoid silent swallowing
        throw new Error(formatted);
      }
      // Surface diagnostics in non-strict mode without interrupting the stream
      console.warn(formatted);
    },
  });
  async function* map(): AsyncIterable<GeminiStreamChunk> {
    for await (const ev of ensureOpenAIResponseStream(stream)) {
      const res = processOpenAIEventToGemini(state, ev);
      for (const ch of res.chunks) {
        yield ch;
      }
    }
  }
  return map();
}
