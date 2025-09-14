/**
 * @file Message content conversion helpers
 */

import type { GeminiPart as ClientGeminiPart } from "../../../providers/gemini/client/fetch-client";
import { isInputImage, isInputText } from "../../../providers/openai/responses-guards";
import { isObject } from "../../../utils/type-guards";
import { dataUrlToInlineData } from "./utils";

/** Convert OpenAI message content parts to Gemini parts */
export function convertMessageContentToGeminiParts(content: unknown): ClientGeminiPart[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const parts: ClientGeminiPart[] = [];
  for (const item of content) {
    if (isInputText(item)) {
      parts.push({ text: item.text } as ClientGeminiPart);
      continue;
    }
    if (isInputImage(item)) {
      const iu = item.image_url;
      if (typeof iu === "string") {
        const inline = dataUrlToInlineData(iu);
        parts.push(inline ? ({ inlineData: inline } as ClientGeminiPart) : ({ fileData: { fileUri: iu } } as ClientGeminiPart));
        continue;
      }
      if (isObject(iu)) {
        const urlVal = (iu as Record<string, unknown>)["url"];
        if (typeof urlVal === "string") {
          const inline = dataUrlToInlineData(urlVal);
          parts.push(inline ? ({ inlineData: inline } as ClientGeminiPart) : ({ fileData: { fileUri: urlVal } } as ClientGeminiPart));
        }
        continue;
      }
      continue;
    }
  }
  return parts;
}
