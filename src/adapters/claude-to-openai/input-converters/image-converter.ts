/**
 * @file Image conversion utilities for Claude to OpenAI Response API transformation
 * Handles conversion of Claude image blocks (base64 and URL sources) to OpenAI input image format
 */
import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { isClaudeBase64Source, isClaudeURLSource } from "../../../providers/claude/guards";

/**
 * Transforms Claude image block parameters into OpenAI-compatible image input format.
 * Handles both base64-encoded images and URL references, ensuring proper data URI
 * formatting for OpenAI's image processing pipeline. Critical for maintaining image
 * context when adapting Claude workflows to OpenAI Response API.
 *
 * @param img - Claude image block containing source data or URL reference
 * @returns OpenAI-compatible image input with proper URL formatting and detail level
 */
export function convertClaudeImageToOpenAI(img: ImageBlockParam): {
  type: "input_image";
  image_url: string;
  detail: "auto";
} {
  const src = img.source;
  if (isClaudeBase64Source(src)) {
    return { type: "input_image", image_url: `data:${src.media_type};base64,${src.data}`, detail: "auto" };
  }
  if (isClaudeURLSource(src)) {
    return { type: "input_image", image_url: src.url, detail: "auto" };
  }
  throw new Error("Unsupported image source");
}
