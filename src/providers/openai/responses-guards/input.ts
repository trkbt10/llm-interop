/**
 * @file Type guards for OpenAI Responses API input structures
 *
 * Why: Provides type-safe runtime checks for input-related structures
 * including messages, text inputs, and image inputs.
 */

import type {
  EasyInputMessage,
  ResponseInputText,
  ResponseInputImage,
} from "openai/resources/responses/responses";

/**
 * Checks if an item is an EasyInputMessage.
 * @param item - The item to validate
 * @returns True if item is EasyInputMessage
 */
export const isEasyInputMessage = (item: unknown): item is EasyInputMessage => {
  if (!item) {
    return false;
  }
  if (typeof item !== "object") {
    return false;
  }
  if (!("role" in item)) {
    return false;
  }
  if (!("content" in item)) {
    return false;
  }
  if ("type" in item) {
    return (item as unknown as { type: string }).type === "message";
  }
  return true;
};

/**
 * Checks if an item is a ResponseInputText.
 * @param item - The item to validate
 * @returns True if item is ResponseInputText
 */
export const isInputText = (item: unknown): item is ResponseInputText => {
  if (!item) {
    return false;
  }
  if (typeof item !== "object") {
    return false;
  }
  if ((item as unknown as { type: string }).type !== "input_text") {
    return false;
  }
  return "text" in item;
};

/**
 * Checks if an item is a ResponseInputImage.
 * @param item - The item to validate
 * @returns True if item is ResponseInputImage
 */
export const isInputImage = (item: unknown): item is ResponseInputImage => {
  if (!item) {
    return false;
  }
  if (typeof item !== "object") {
    return false;
  }
  if ((item as unknown as { type: string }).type !== "input_image") {
    return false;
  }
  return "image_url" in item;
};