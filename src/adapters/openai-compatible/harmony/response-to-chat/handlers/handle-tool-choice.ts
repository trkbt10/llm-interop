/**
 * @file Handle tool choice parameter.
 */

import type { ToolChoice } from "../../types";
import { isToolChoiceFunction, isToolChoiceCustom, isToolChoiceAllowed } from "../../utils/type-guards";

/**
 * Converts tool choice parameters into clear natural language instructions for LLM guidance.
 * Transforms structured tool choice specifications (none, auto, required, specific functions)
 * into human-readable directives that help LLMs understand when and how to use available tools.
 * Essential for controlling tool usage behavior in Harmony workflows.
 *
 * @param toolChoice - Tool choice configuration specifying tool usage requirements
 * @returns Natural language instruction for tool usage or undefined for default behavior
 */
export function handleToolChoice(toolChoice?: ToolChoice): string | undefined {
  if (!toolChoice) {
    return undefined;
  }

  // Handle string options
  if (typeof toolChoice === "string") {
    switch (toolChoice) {
      case "none":
        return "Do not use any tools.";
      case "auto":
        return undefined; // Default behavior, no special instruction needed
      case "required":
        return "You MUST call at least one tool function. Do not respond directly without using tools.";
      default:
        return undefined;
    }
  }

  // Handle object options
  if (typeof toolChoice === "object") {
    // ToolChoiceAllowed
    if (isToolChoiceAllowed(toolChoice)) {
      if (toolChoice.mode === "required") {
        if ("tools" in toolChoice) {
          const tools = toolChoice.tools;
          if (Array.isArray(tools)) {
            if (tools.length > 0) {
              const toolNames = tools
                .map((t) => (typeof t.name === "string" ? t.name : t.type))
                .filter(Boolean)
                .join(", ");
              if (toolNames) {
                return `You must use one of these tools: ${toolNames}.`;
              }
            }
          }
        }
        return "You MUST call at least one tool function. Do not respond directly without using tools.";
      }
      return undefined; // auto mode is default
    }

    // ToolChoiceFunction
    if (isToolChoiceFunction(toolChoice)) {
      if (toolChoice.name) {
        return `You must use the ${toolChoice.name} function.`;
      }
    }

    // ToolChoiceCustom
    if (isToolChoiceCustom(toolChoice)) {
      if (toolChoice.name) {
        return `You must use the ${toolChoice.name} tool.`;
      }
    }
  }

  return undefined;
}
