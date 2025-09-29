/**
 * @file Convert OpenAI tools to Harmony TypeScript-like format.
 */

import { convertJsonSchemaToTypeScript } from "./convert-json-schema";
import { isFunctionTool, isWebSearchTool, isCodeInterpreterTool } from "../../utils/type-guards";
import type { Tool, FunctionTool } from "openai/resources/responses/responses.js";

const INDENT = "  ";

type FunctionToolLike = FunctionTool & { name: string };

const DEFAULT_DESCRIPTION = "No description provided";

function sanitizeToolName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "unnamed_tool";
  }
  const normalized = trimmed.replace(/[^A-Za-z0-9_]/g, "_");
  if (/^[A-Za-z_]/.test(normalized)) {
    return normalized;
  }
  return `fn_${normalized}`;
}

function formatToolDescription(tool: FunctionToolLike): string {
  const rawDescription = typeof tool.description === "string" ? tool.description.trim() : "";
  const normalized = rawDescription.length > 0 ? rawDescription : DEFAULT_DESCRIPTION;
  return normalized.replace(/\s+/g, " ");
}

function formatFunctionType(tool: FunctionToolLike): string {
  if (!tool.parameters || Object.keys(tool.parameters).length === 0) {
    return "() => any";
  }
  const paramsType = convertJsonSchemaToTypeScript(tool.parameters, `${INDENT}${INDENT}`);
  return `(_: ${paramsType}) => any`;
}

function formatFunctionTool(tool: FunctionToolLike): string[] {
  const lines: string[] = [];
  lines.push(`// ${formatToolDescription(tool)}`);
  if (tool.strict === true) {
    lines.push("// Arguments must strictly follow the defined JSON schema.");
  }
  const signature = formatFunctionType(tool);
  lines.push(`type ${sanitizeToolName(tool.name)} = ${signature};`);
  lines.push("");
  return lines;
}

/**
 * Converts OpenAI tool definitions into Harmony TypeScript-style format strings.
 * Transforms function tool schemas into readable TypeScript namespace declarations
 * that help LLMs understand available functions and their parameters. Essential
 * for providing clear tool context in Harmony system messages.
 *
 * @param tools - Array of OpenAI tool definitions requiring Harmony formatting
 * @returns TypeScript-style namespace string describing available functions
 */
export function convertToolsToHarmonyFormat(tools: Tool[] | null | undefined): string {
  if (!Array.isArray(tools) || tools.length === 0) {
    return "";
  }

  const functionTools = tools
    .filter(isFunctionTool)
    .filter((tool): tool is FunctionToolLike => typeof tool.name === "string" && tool.name.trim().length > 0);

  if (functionTools.length === 0) {
    return "";
  }

  const sorted = [...functionTools].sort((a, b) => a.name.localeCompare(b.name));

  const lines: string[] = [];
  lines.push("## functions");
  lines.push("");
  lines.push("namespace functions {");
  lines.push("");

  for (const tool of sorted) {
    lines.push(...formatFunctionTool(tool));
  }

  // Remove trailing empty line for neatness
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  lines.push("} // namespace functions");

  return lines.join("\n");
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
