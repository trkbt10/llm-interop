/**
 * @file Utilities for OpenAI→Gemini request conversion
 */

import type { GeminiPart as ClientGeminiPart } from "../../../providers/gemini/client/fetch-client";
import { isObject } from "../../../utils/type-guards";

/** Parse a data: URL into inlineData for Gemini */
export function dataUrlToInlineData(url: string): { mimeType: string; data: string } | undefined {
  if (!url.startsWith("data:")) {
    return undefined;
  }
  const comma = url.indexOf(",");
  if (comma < 0) {
    return undefined;
  }
  const header = url.slice(5, comma); // after 'data:'
  const payload = url.slice(comma + 1);
  const semi = header.indexOf(";");
  const mime = semi >= 0 ? header.slice(0, semi) : header;
  const mimeType = mime ? mime : "application/octet-stream";
  return { mimeType, data: payload };
}

/** Parse function call arguments from JSON object/string */
export function parseArgs(value: unknown): Record<string, unknown> | undefined {
  if (isObject(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (isObject(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Build a Gemini functionCall part */
export function fnCall(name: string, args?: Record<string, unknown>): ClientGeminiPart {
  if (args && Object.keys(args).length > 0) {
    return { functionCall: { name, args } } as ClientGeminiPart;
  }
  return { functionCall: { name } } as ClientGeminiPart;
}
