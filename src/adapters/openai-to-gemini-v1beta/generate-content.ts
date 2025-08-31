/**
 * @file generateContent implementation for OpenAI → Gemini v1beta adapter
 */
import type { OpenAICompatibleClient, OpenAIResponse, ResponseCreateParamsNonStreaming } from "../openai-client-types";
import type { GeminiRequest, GeminiResponse } from "./core/gemini-types";
import { buildNonStreamingParams } from "./core/request-mapper";
import { isAsyncIterable } from "./core/guards";
import { isOpenAIResponse } from "../../providers/openai/responses-guards";
import { toGeminiResponse } from "./core/response-mapper";
import type { ResponseStreamEvent, ResponseTextDeltaEvent, ResponseCompletedEvent } from "openai/resources/responses/responses";

/**
 * Emulate v1beta generateContent using the OpenAI Responses API.
 * Uses only the first user text and optional systemInstruction; ignores tools.
 */
export async function generateContent(
  client: OpenAICompatibleClient,
  model: string,
  body: GeminiRequest,
  options?: { signal?: AbortSignal },
): Promise<GeminiResponse> {
  const params: ResponseCreateParamsNonStreaming = buildNonStreamingParams(model, body);
  const result = await client.responses.create(params, options);
  // If upstream returns a stream unexpectedly, accumulate into a non-stream GeminiResponse
  if (isAsyncIterable<ResponseStreamEvent>(result)) {
    const aggregate = async (): Promise<GeminiResponse> => {
      const buffer: { text: string[]; finish?: string } = { text: [] };
      for await (const ev of result) {
        if (ev.type === "response.output_text.delta") {
          buffer.text.push((ev as ResponseTextDeltaEvent).delta ?? "");
          continue;
        }
        if (ev.type === "response.completed") {
          const status = (ev as ResponseCompletedEvent).response.status;
          buffer.finish = status === "incomplete" ? "MAX_TOKENS" : "STOP";
        }
      }
      const joined = buffer.text.join("");
      return {
        candidates: [
          {
            content: { parts: [{ text: joined }], role: "model" },
            finishReason: buffer.finish ?? "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
      };
    };
    return aggregate();
  }
  if (!isOpenAIResponse(result)) {
    throw new Error("Unexpected response shape from Responses API");
  }
  return toGeminiResponse(result as OpenAIResponse);
}
