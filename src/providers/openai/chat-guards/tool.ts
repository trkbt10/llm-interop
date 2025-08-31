/**
 * @file Type guards for OpenAI Chat Completion tool types
 *
 * Why: Provides comprehensive type guards for tool-related types
 * including function tools, custom tools, and tool choices.
 */

import type {
  ChatCompletionTool,
  ChatCompletionFunctionTool,
  ChatCompletionCustomTool,
  ChatCompletionToolChoiceOption,
  ChatCompletionNamedToolChoice,
  ChatCompletionNamedToolChoiceCustom,
  ChatCompletionFunctionCallOption,
  ChatCompletionAllowedToolChoice,
  ChatCompletionAllowedTools,
} from "openai/resources/chat/completions";
import { isObject } from "../../../utils/type-guards";

/**
 * Check if a tool is a function tool
 */
export function isOpenAIChatFunctionTool(t: ChatCompletionTool): t is ChatCompletionFunctionTool {
  if (!isObject(t)) {
    return false;
  }

  if ((t as { type?: unknown }).type !== "function") {
    return false;
  }

  if (!isObject((t as { function?: unknown }).function)) {
    return false;
  }

  return typeof (t as { function: { name?: unknown } }).function.name === "string";
}

/**
 * Check if a tool is a custom tool
 */
export function isChatCompletionCustomTool(tool: ChatCompletionTool): tool is ChatCompletionCustomTool {
  return tool.type === "custom";
}

/**
 * Check if a value is a ChatCompletionTool
 */
export function isChatCompletionTool(value: unknown): value is ChatCompletionTool {
  if (!isObject(value)) {
    return false;
  }
  const tool = value as { type?: unknown };
  return tool.type === "function" || tool.type === "custom";
}

/**
 * Check if a tool choice is a function tool choice
 */
export function isOpenAIChatFunctionToolChoice(
  tc: unknown,
): tc is Extract<ChatCompletionToolChoiceOption, { type: "function" }> {
  if (!isObject(tc)) {
    return false;
  }

  if ((tc as { type?: unknown }).type !== "function") {
    return false;
  }

  if (!isObject((tc as { function?: unknown }).function)) {
    return false;
  }

  return typeof (tc as { function: { name?: unknown } }).function.name === "string";
}

/**
 * Check if a tool choice option is a function tool choice (simplified version)
 */
export function isFunctionToolChoice(
  tc: ChatCompletionToolChoiceOption | undefined,
): tc is Extract<ChatCompletionToolChoiceOption, { type: "function" }> {
  if (isObject(tc) && "type" in tc) {
    return (tc as { type?: unknown }).type === "function";
  }
  return false;
}

/**
 * Check if a tool choice is a string option (auto, none, required)
 */
export function isToolChoiceString(
  tc: ChatCompletionToolChoiceOption
): tc is "auto" | "none" | "required" {
  return tc === "auto" || tc === "none" || tc === "required";
}

/**
 * Check if a tool choice is a named tool choice
 */
export function isNamedToolChoice(
  tc: ChatCompletionToolChoiceOption
): tc is ChatCompletionNamedToolChoice {
  return isObject(tc) && "type" in tc && (tc.type === "function" || tc.type === "custom");
}

/**
 * Check if a tool choice is a custom named tool choice
 */
export function isNamedToolChoiceCustom(
  tc: ChatCompletionToolChoiceOption
): tc is ChatCompletionNamedToolChoiceCustom {
  return isObject(tc) && "type" in tc && tc.type === "custom";
}

/**
 * Check if a value is a function call option (deprecated)
 */
export function isFunctionCallOption(value: unknown): value is ChatCompletionFunctionCallOption {
  if (!isObject(value)) {
    return false;
  }
  const opt = value as { name?: unknown };
  return typeof opt.name === "string";
}

/**
 * Check if a value is an allowed tool choice
 */
export function isAllowedToolChoice(value: unknown): value is ChatCompletionAllowedToolChoice {
  if (!isObject(value)) {
    return false;
  }
  const choice = value as { tool_choice?: unknown };
  return choice.tool_choice !== undefined;
}

/**
 * Check if a value is allowed tools configuration
 */
export function isAllowedTools(value: unknown): value is ChatCompletionAllowedTools {
  if (!isObject(value)) {
    return false;
  }
  const config = value as { tools?: unknown };
  return Array.isArray(config.tools);
}

/**
 * Check if tools array contains function tools
 */
export function hasFunctionTools(tools: ChatCompletionTool[]): boolean {
  return tools.some(tool => tool.type === "function");
}

/**
 * Check if tools array contains custom tools
 */
export function hasCustomTools(tools: ChatCompletionTool[]): boolean {
  return tools.some(tool => tool.type === "custom");
}

/**
 * Filter function tools from tools array
 */
export function filterFunctionTools(tools: ChatCompletionTool[]): ChatCompletionFunctionTool[] {
  return tools.filter((tool): tool is ChatCompletionFunctionTool => tool.type === "function");
}

/**
 * Filter custom tools from tools array
 */
export function filterCustomTools(tools: ChatCompletionTool[]): ChatCompletionCustomTool[] {
  return tools.filter((tool): tool is ChatCompletionCustomTool => tool.type === "custom");
}