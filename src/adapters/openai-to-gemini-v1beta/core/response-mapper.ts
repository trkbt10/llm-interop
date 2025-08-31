/**
 * @file Convert OpenAI Responses → Gemini v1beta response
 */
import type { OpenAIResponse } from "../../openai-client-types";
import { isResponseOutputMessage, isResponseOutputText } from "../../../providers/openai/responses-guards";
import type { GeminiResponse } from "./gemini-types";

/**
 * Convert an OpenAI Responses result into a v1beta Gemini response.
 * Differences: collapses output array to first text block and maps usage to Gemini usageMetadata.
 */
export function toGeminiResponse(resp: OpenAIResponse): GeminiResponse {
  const output = Array.isArray(resp.output) ? resp.output : [];
  // Compute first text from the first output message's output_text part; otherwise fallback to top-level output_text
  const text: string = (() => {
    const msg = output.find(isResponseOutputMessage);
    if (msg && Array.isArray(msg.content)) {
      const textPart = msg.content.find(isResponseOutputText);
      if (textPart && typeof textPart.text === "string") {
        return textPart.text;
      }
    }
    const top = (resp as { output_text?: unknown }).output_text;
    return typeof top === "string" ? top : "";
  })();
  const inTok = resp.usage?.input_tokens ?? 0;
  const outTok = resp.usage?.output_tokens ?? 0;
  return {
    candidates: [
      {
        content: { parts: [{ text }], role: "model" },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: inTok,
      candidatesTokenCount: outTok,
      totalTokenCount: inTok + outTok,
    },
  };
}

/**
 * Extract first text chunk from a Gemini v1beta response.
 * Safe against missing candidates/content/parts and non-text parts.
 */
export function extractFirstText(resp: GeminiResponse): string {
  const cands = Array.isArray(resp.candidates) ? resp.candidates : [];
  if (cands.length === 0) {
    return "";
  }
  const content = cands[0]?.content;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  for (const p of parts as Array<{ text?: unknown }>) {
    if (typeof p?.text === "string") {
      return String(p.text);
    }
  }
  return "";
}
