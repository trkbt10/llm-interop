/**
 * @file Convert OpenAI tools to Harmony TypeScript-like format.
 */

import type { Tool } from "../../types";
import { convertJsonSchemaToTypeScript } from "./convert-json-schema";
import { isFunctionTool, isWebSearchTool, isCodeInterpreterTool } from "../../utils/type-guards";

/**
 * Converts OpenAI tool definitions into Harmony TypeScript-style format strings.
 * Transforms function tool schemas into readable TypeScript namespace declarations
 * that help LLMs understand available functions and their parameters. Essential
 * for providing clear tool context in Harmony system messages.
 *
 * @param tools - Array of OpenAI tool definitions requiring Harmony formatting
 * @returns TypeScript-style namespace string describing available functions
 */
export function convertToolsToHarmonyFormat(tools: Tool[]): string {
  if (!tools || tools.length === 0) {
    return "";
  }

  // Extract function tools for namespace generation
  const functionTools = tools.filter(isFunctionTool);

  // eslint-disable-next-line no-restricted-syntax -- Building formatted tool string requires accumulation
  let result = "";

  // Add function tools namespace
  if (functionTools.length > 0) {
    result += "## functions\n\nnamespace functions {\n\n";

    for (const tool of functionTools) {
      const description = tool.description ? tool.description : "No description provided";
      const params = tool.parameters;

      // Add description as comment
      result += `// ${description}\n`;

      // Format function type
      if (!params || Object.keys(params).length === 0) {
        result += `type ${tool.name} = () => any;\n\n`;
        continue;
      }

      const paramsType = convertJsonSchemaToTypeScript(params, "");
      result += `type ${tool.name} = (_: ${paramsType}) => any;\n\n`;
    }

    result += "} // namespace functions";
  }

  // Note: Built-in tools like browser and python are handled separately in system message
  // Built-in tool detection is handled by getBuiltinToolTypes function

  // Return the formatted tools
  return result;
}

/**
 * Identifies built-in tool types present in the tool array for Harmony system configuration.
 * Scans tool definitions to detect special built-in capabilities (web search, code interpreter)
 * that require specific Harmony system message setup. Enables proper tool environment
 * initialization for LLM processing.
 *
 * @param tools - Array of tools requiring built-in type detection
 * @returns Array of detected built-in tool types for system configuration
 */
export function getBuiltinToolTypes(tools: Tool[]): Array<"browser" | "python"> {
  const builtinTypes: Array<"browser" | "python"> = [];

  if (tools.some(isWebSearchTool)) {
    builtinTypes.push("browser");
  }

  if (tools.some(isCodeInterpreterTool)) {
    builtinTypes.push("python");
  }

  return builtinTypes;
}
