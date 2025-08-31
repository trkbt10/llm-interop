/**
 * @file Type guards for OpenAI Chat Completion content types
 *
 * Why: Provides comprehensive type guards for content parts and modalities
 * in the Chat Completions API.
 */

import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionContentPartImage,
  ChatCompletionContentPartInputAudio,
  ChatCompletionContentPartRefusal,
  ChatCompletionModality,
  ChatCompletionAudio,
  ChatCompletionAudioParam,
  ChatCompletionPredictionContent,
} from "openai/resources/chat/completions";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if a content part is a text part
 */
export function isOpenAIChatTextPart(part: unknown): part is ChatCompletionContentPartText {
  if (!isObject(part)) {
    return false;
  }

  if ((part as { type?: unknown }).type !== "text") {
    return false;
  }

  return typeof (part as { text?: unknown }).text === "string";
}

/**
 * Check if a content part is an image part
 */
export function isChatImagePart(part: ChatCompletionContentPart): part is ChatCompletionContentPartImage {
  return part.type === "image_url";
}

/**
 * Check if a content part is an input audio part
 */
export function isChatInputAudioPart(part: ChatCompletionContentPart): part is ChatCompletionContentPartInputAudio {
  return part.type === "input_audio";
}

/**
 * Check if a content part is a refusal part
 */
export function isChatRefusalPart(part: unknown): part is ChatCompletionContentPartRefusal {
  if (!isObject(part)) {
    return false;
  }
  return (part as { type?: unknown }).type === "refusal";
}

/**
 * Check if a value is a ChatCompletionContentPart
 */
export function isChatCompletionContentPart(value: unknown): value is ChatCompletionContentPart {
  if (!isObject(value)) {
    return false;
  }
  const part = value as { type?: unknown };
  return (
    part.type === "text" ||
    part.type === "image_url" ||
    part.type === "input_audio" ||
    part.type === "refusal"
  );
}

/**
 * Check if content is a string
 */
export function isStringContent(content: unknown): content is string {
  return typeof content === "string";
}

/**
 * Check if content is an array of content parts
 */
export function isContentPartArray(content: unknown): content is ChatCompletionContentPart[] {
  return Array.isArray(content) && content.every(item => isChatCompletionContentPart(item));
}

/**
 * Check if a value is a valid modality
 */
export function isChatCompletionModality(value: unknown): value is ChatCompletionModality {
  return value === "text" || value === "audio";
}

/**
 * Check if a value is ChatCompletionAudio
 */
export function isChatCompletionAudio(value: unknown): value is ChatCompletionAudio {
  if (!isObject(value)) {
    return false;
  }
  const audio = value as Record<string, unknown>;
  return (
    typeof audio.id === "string" &&
    typeof audio.expires_at === "number" &&
    typeof audio.data === "string" &&
    typeof audio.transcript === "string"
  );
}

/**
 * Check if a value is ChatCompletionAudioParam
 */
export function isChatCompletionAudioParam(value: unknown): value is ChatCompletionAudioParam {
  if (!isObject(value)) {
    return false;
  }
  const param = value as Record<string, unknown>;
  // Voice is required
  if (typeof param.voice !== "string") {
    return false;
  }
  // Format is optional but if present must be valid
  if (param.format !== undefined && param.format !== "wav" && param.format !== "mp3" && 
      param.format !== "flac" && param.format !== "opus" && param.format !== "pcm16") {
    return false;
  }
  return true;
}

/**
 * Check if a value is ChatCompletionPredictionContent
 */
export function isChatCompletionPredictionContent(value: unknown): value is ChatCompletionPredictionContent {
  if (!isObject(value)) {
    return false;
  }
  const content = value as Record<string, unknown>;
  return content.type === "content" && Array.isArray(content.content);
}

/**
 * Extract text content from content parts
 */
export function extractTextFromContentParts(parts: ChatCompletionContentPart[]): string[] {
  return parts
    .filter((part): part is ChatCompletionContentPartText => part.type === "text")
    .map(part => part.text);
}

/**
 * Check if content parts contain images
 */
export function hasImageContent(parts: ChatCompletionContentPart[]): boolean {
  return parts.some(part => part.type === "image_url");
}

/**
 * Check if content parts contain audio
 */
export function hasAudioContent(parts: ChatCompletionContentPart[]): boolean {
  return parts.some(part => part.type === "input_audio");
}

/**
 * Check if content parts contain refusal
 */
export function hasRefusalContent(parts: ChatCompletionContentPart[]): boolean {
  return parts.some(part => isChatRefusalPart(part));
}

/**
 * Filter text parts from content parts
 */
export function filterTextParts(parts: ChatCompletionContentPart[]): ChatCompletionContentPartText[] {
  return parts.filter((part): part is ChatCompletionContentPartText => part.type === "text");
}

/**
 * Filter image parts from content parts
 */
export function filterImageParts(parts: ChatCompletionContentPart[]): ChatCompletionContentPartImage[] {
  return parts.filter((part): part is ChatCompletionContentPartImage => part.type === "image_url");
}