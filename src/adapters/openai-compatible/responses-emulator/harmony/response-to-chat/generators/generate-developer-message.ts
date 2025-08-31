/**
 * @file Generate Harmony developer message.
 */

import type { ResponseCreateParamsBase } from "../../types";
import { HARMONY_ROLES } from "../../constants";
import { formatHarmonyMessage } from "../../utils/format-harmony-message";
import { convertToolsToHarmonyFormat } from "../converters/convert-tools";
import { handleResponseFormat } from "../handlers/handle-response-format";
import { handleToolChoice } from "../handlers/handle-tool-choice";

/**
 * Constructs Harmony developer messages containing task-specific instructions and tool definitions.
 * Assembles custom instructions, tool choice directives, function definitions, and response format
 * requirements into a structured developer message. Essential for providing task-specific context
 * that supplements the general system message with request-specific guidance.
 *
 * @param params - Response API parameters containing instructions, tools, and format requirements
 * @returns Formatted Harmony developer message or undefined if no developer-specific content present
 */
export function generateDeveloperMessage(params: ResponseCreateParamsBase): string | undefined {
  const sections: string[] = [];

  // Add instructions if present
  if (params.instructions) {
    sections.push("# Instructions");
    sections.push("");
    sections.push(params.instructions);
  }

  // Add tool choice instructions if needed
  const toolChoiceInstructions = handleToolChoice(params.tool_choice);
  if (toolChoiceInstructions) {
    if (sections.length === 0) {
      sections.push("# Instructions");
      sections.push("");
    }

    if (sections.length > 0 && sections[sections.length - 1] !== "") {
      sections.push("");
    }

    sections.push(toolChoiceInstructions);
  }

  // Add tools if present
  if (params.tools && params.tools.length > 0) {
    const toolsFormat = convertToolsToHarmonyFormat(params.tools);
    if (toolsFormat) {
      if (sections.length > 0) {
        sections.push("");
      }
      sections.push("# Tools");
      sections.push("");
      sections.push(toolsFormat);
    }
  }

  // Add response format if present
  const responseFormat = handleResponseFormat(params.text);
  if (responseFormat) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push(responseFormat);
  }

  // If no content, return undefined
  if (sections.length === 0) {
    return undefined;
  }

  const content = sections.join("\n");

  // Format as Harmony message
  return formatHarmonyMessage({
    role: HARMONY_ROLES.DEVELOPER,
    content,
  });
}
