/**
 * @file Shared utilities for converting between OpenAI Chat Completions and Responses API tool formats
 *
 * Why: Provides reusable tool conversion functions that can be shared across different adapters
 * to avoid circular dependencies and code duplication.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Tool } from "openai/resources/responses/responses";
import { isOpenAIChatFunctionTool } from "../../providers/openai/chat-guards";
import { isObject } from "../../utils/type-guards";

/**
 * Convert a single chat tool to responses tool format
 */
export function convertOpenAIChatToolToResponsesTool(chatTool: ChatCompletionTool): Tool | undefined {
  if (!isOpenAIChatFunctionTool(chatTool)) {
    return undefined;
  }

  const raw = (chatTool.function as { parameters?: unknown }).parameters;
  const params: Record<string, unknown> | null = isObject(raw) ? (raw as Record<string, unknown>) : null;
  const description = typeof chatTool.function.description === "string" ? chatTool.function.description : undefined;

  return {
    type: "function",
    name: chatTool.function.name,
    description,
    parameters: params,
    strict: false,
  };
}
