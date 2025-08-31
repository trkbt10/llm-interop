/**
 * @file Message conversion utilities for Claude to OpenAI Response API transformation
 * Handles conversion of complete Claude message structures to OpenAI Response API input items
 */
import type { MessageParam as ClaudeMessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { toOpenAICallIdFromClaude } from "../../conversation/id-conversion";
import { isClaudeImageBlockParam, isClaudeToolResultBlockParam } from "../../../providers/claude/guards";
import { convertClaudeImageToOpenAI } from "./image-converter";
import { convertToolResult } from "./tool-result-converter";

function convertAssistantMessage(blocks: ContentBlockParam[]): ResponseInputItem[] {
  const result: ResponseInputItem[] = [];
  const textParts: string[] = [];

  const flushText = (accumulator: string[]) => {
    if (accumulator.length > 0) {
      result.push({ role: "assistant", content: accumulator.join("") });
    }
  };

  for (const block of blocks) {
    if (block.type === "text" && typeof block.text === "string") {
      textParts.push(block.text);
      continue;
    }

    if (block.type === "tool_use") {
      if ("id" in block && "name" in block) {
        flushText(textParts);
        textParts.length = 0; // Clear the array
        const args = JSON.stringify(block.input ?? {});
        const callId = toOpenAICallIdFromClaude(block.id);
        result.push({ type: "function_call", call_id: callId, name: block.name, arguments: args });
      }
    }
  }

  flushText(textParts);
  return result;
}

function convertUserMessage(blocks: ContentBlockParam[]): ResponseInputItem[] {
  const result: ResponseInputItem[] = [];
  const textParts: Array<{ type: "input_text"; text: string }> = [];

  const flushTextParts = (parts: Array<{ type: "input_text"; text: string }>) => {
    if (parts.length > 0) {
      result.push({ role: "user", content: [...parts] });
    }
  };

  for (const block of blocks) {
    if (block.type === "text" && typeof block.text === "string") {
      textParts.push({ type: "input_text", text: block.text });
      continue;
    }

    if (isClaudeImageBlockParam(block)) {
      flushTextParts(textParts);
      textParts.length = 0; // Clear the array
      const img = convertClaudeImageToOpenAI(block);
      result.push({ role: "user", content: [img] });
      continue;
    }

    if (isClaudeToolResultBlockParam(block)) {
      flushTextParts(textParts);
      textParts.length = 0; // Clear the array
      result.push(convertToolResult(block));
    }
  }

  // Final flush: if single part remaining, emit as plain string to match expected shape
  if (textParts.length === 1) {
    const only = textParts[0];
    result.push({ role: "user", content: only.text });
    return result;
  }

  flushTextParts(textParts);
  return result;
}

/**
 * Transforms complete Claude message structures into OpenAI Response API input items.
 * Handles complex message content including text, images, tool calls, and tool results,
 * ensuring proper role mapping and content structure conversion. Central function for
 * enabling Claude conversation flows within OpenAI-compatible processing pipelines.
 *
 * @param message - Claude message with role and content blocks (text, images, tools)
 * @returns Array of OpenAI Response API input items preserving conversation structure
 */
export function convertClaudeMessage(message: ClaudeMessageParam): ResponseInputItem[] {
  const role = message.role;
  const content = message.content;

  if (typeof content === "string") {
    return [{ role, content }];
  }

  // content is array of blocks
  const blocks = content as ContentBlockParam[];

  if (role === "assistant") {
    return convertAssistantMessage(blocks);
  }

  if (role === "user") {
    return convertUserMessage(blocks);
  }

  // default passthrough for developer/system
  return [{ role, content: "" }];
}
