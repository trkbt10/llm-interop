/**
 * @file Build OpenAI Responses params from Gemini v1beta request
 */
import type { ResponseCreateParamsNonStreaming, ResponseCreateParamsStreaming } from "../../openai-client-types";
import type { GeminiContent, GeminiRequest, GeminiPart } from "./gemini-types";

/** Extract first user text from contents or empty string */
export function firstTextFromContents(contents?: GeminiContent[]): string {
  if (!Array.isArray(contents) || contents.length === 0) {
    return "";
  }
  const parts = contents[0]?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return "";
  }
  const p: GeminiPart = parts[0] as GeminiPart;
  if (typeof (p as { text?: unknown }).text === "string") {
    return String((p as { text?: unknown }).text);
  }
  return "";
}

/** Extract system instruction text if present */
export function systemInstructionText(): string | undefined {
  // Not supported in our minimal request model
  return undefined;
}

/** Build non-streaming Responses params from v1beta request */
export function buildNonStreamingParams(model: string, body: GeminiRequest): ResponseCreateParamsNonStreaming {
  const params: ResponseCreateParamsNonStreaming = { model, stream: false, input: "" };
  const input = firstTextFromContents(body.contents);
  if (input) {
    params.input = input;
  }
  const sys = systemInstructionText();
  if (sys) {
    params.instructions = sys;
  }
  const gen = body.generationConfig;
  if (gen && typeof gen.maxOutputTokens === "number") {
    params.max_output_tokens = gen.maxOutputTokens;
  }
  return params;
}

/** Build streaming Responses params from v1beta request */
export function buildStreamingParams(model: string, body: GeminiRequest): ResponseCreateParamsStreaming {
  const base = buildNonStreamingParams(model, body);
  const params: ResponseCreateParamsStreaming = { ...base, stream: true };
  return params;
}
