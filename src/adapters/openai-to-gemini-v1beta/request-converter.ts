/**
 * @file Convert OpenAI Responses params → Gemini v1beta GenerateContent request.
 */
import type {
  ResponseCreateParams,
  ResponseInput,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import type {
  GenerateContentRequest,
  GeminiContent as ClientGeminiContent,
} from "../../providers/gemini/client/fetch-client";
import { isResponseInputMessage } from "../../providers/openai/responses-guards";
import { isObject } from "../../utils/type-guards";
import { convertMessageContentToGeminiParts } from "./request-converter/message-content";
import { convertItemToGeminiContent, ToolNameResolver } from "./request-converter/handlers";

/** Type guard to filter out undefined entries */
function isDefined<T>(v: T | undefined): v is T {
  return v !== undefined;
}

/** Convert OpenAI Responses params into a Gemini GenerateContent request body. */
export function responsesToGeminiRequest(
  params: ResponseCreateParams,
  resolveToolName?: ToolNameResolver,
): GenerateContentRequest {
  const contents: ClientGeminiContent[] = [];

  // instructions -> user text (Gemini v1beta has systemInstruction, but we keep it simple/user)
  const sys = (params as { instructions?: string }).instructions;
  if (typeof sys === "string" && sys.length > 0) {
    contents.push({ role: "user", parts: [{ text: sys }] });
  }

  const input = (params as { input?: unknown }).input as ResponseInput | string | undefined;
  if (typeof input === "string") {
    contents.push({ role: "user", parts: [{ text: input }] } as ClientGeminiContent);
    return buildRequest(contents, params);
  } else if (Array.isArray(input)) {
    const mapped = (input as ResponseInputItem[])
      .map((item) => {
        if (!item || typeof item !== "object") {
          return undefined;
        }
        if (isResponseInputMessage(item)) {
          const role = item.role === "user" ? "user" : "model";
          const converted = convertMessageContentToGeminiParts(item.content);
          if (converted.length > 0) {
            return { role, parts: converted } as ClientGeminiContent;
          }
          return undefined;
        }
        const converted = convertItemToGeminiContent(item, resolveToolName);
        if (converted) {
          return converted;
        }
        try {
          const json = JSON.stringify(item);
          return { role: "user", parts: [{ text: json }] } as ClientGeminiContent;
        } catch {
          return undefined;
        }
      })
      .filter(isDefined);
    contents.push(...mapped);
    return buildRequest(contents, params);
  } else if (isObject(input)) {
    const item = input as ResponseInputItem;
    if (isResponseInputMessage(item)) {
      const role = item.role === "user" ? "user" : "model";
      const converted = convertMessageContentToGeminiParts(item.content);
      if (converted.length > 0) {
        contents.push({ role, parts: converted } as ClientGeminiContent);
      }
      return buildRequest(contents, params);
    }
    const converted = convertItemToGeminiContent(item, resolveToolName);
    if (converted) {
      contents.push(converted);
      return buildRequest(contents, params);
    }
    try {
      const json = JSON.stringify(item);
      contents.push({ role: "user", parts: [{ text: json }] } as ClientGeminiContent);
    } catch {
      // ignore
    }
    return buildRequest(contents, params);
  }

  return buildRequest(contents, params);
}

function buildRequest(contents: ClientGeminiContent[], params: ResponseCreateParams): GenerateContentRequest {
  const body: GenerateContentRequest = { contents };
  const gen: NonNullable<GenerateContentRequest["generationConfig"]> = {};
  const p = params as { max_output_tokens?: number; temperature?: number; top_p?: number };
  if (typeof p.max_output_tokens === "number") { gen.maxOutputTokens = p.max_output_tokens; }
  if (typeof p.temperature === "number") { gen.temperature = p.temperature; }
  if (typeof p.top_p === "number") { gen.topP = p.top_p; }
  if (Object.keys(gen).length > 0) { body.generationConfig = gen; }
  return body;
}
