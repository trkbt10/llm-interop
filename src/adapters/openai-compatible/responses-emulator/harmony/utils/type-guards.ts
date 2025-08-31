/**
 * @file Type guards for Harmony harmonizer
 */

import type {
  Tool,
  FunctionTool,
  FileSearchTool,
  WebSearchTool,
  ComputerTool,
  CustomTool,
  ResponseInputItem,
  ResponseTextConfig,
  ToolChoiceAllowed,
  ToolChoiceFunction,
  ToolChoiceCustom,
  ResponseCreateParamsBase,
} from "../types";

/**
 * Validates if a value is a non-null object suitable for property access.
 * Foundation guard that prevents runtime errors when accessing object properties
 * during parameter validation. Essential for safe type narrowing in subsequent guards.
 *
 * @param v - Value of unknown type requiring object validation
 * @returns True if value is a non-null object with accessible properties
 */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Parameter validation type guards

/**
 * Ensures input conforms to the basic structure expected for Response API parameters.
 * Provides the foundational validation layer for all Response API requests,
 * establishing that the input is a proper object before detailed parameter validation.
 *
 * @param v - Unknown input requiring Response API parameter validation
 * @returns True if input meets basic Response API parameter structure requirements
 */
export function isValidResponseCreateParams(v: unknown): v is ResponseCreateParamsBase {
  return isObject(v);
}

/**
 * Verifies that request parameters contain a valid model identifier string.
 * Critical for ensuring LLM provider routing works correctly, as the model name
 * determines which AI service and specific model variant will process the request.
 *
 * @param params - Request parameters requiring model validation
 * @returns True if parameters contain a valid string model identifier
 */
export function hasValidModel(params: unknown): params is { model: string } {
  if (!isObject(params)) {
    return false;
  }
  if (!("model" in params)) {
    return false;
  }
  return typeof params.model === "string";
}

/**
 * Validates that request contains properly formatted input for LLM processing.
 * Ensures the input is either a simple string prompt or a structured array of
 * input items, which determines how the LLM will interpret and respond to user content.
 *
 * @param params - Request parameters requiring input validation
 * @returns True if parameters contain valid string or structured input format
 */
export function hasValidInput(params: unknown): params is { input: string | ResponseInputItem[] } {
  if (!isObject(params)) {
    return false;
  }
  if (!("input" in params)) {
    return false;
  }
  return typeof params.input === "string" ? true : Array.isArray(params.input);
}

/**
 * Confirms that system instructions are properly formatted for LLM behavior guidance.
 * System instructions shape how the LLM responds and behaves, so validation ensures
 * they're either null (no custom behavior) or a string containing guidance.
 *
 * @param params - Request parameters requiring instruction validation
 * @returns True if parameters contain null or valid string instructions
 */
export function hasValidInstructions(params: unknown): params is { instructions?: string } {
  if (!isObject(params)) {
    return false;
  }
  if (!("instructions" in params)) {
    return false;
  }
  return typeof (params as { instructions?: unknown }).instructions === "string";
}

/**
 * Validates temperature setting for controlling LLM response randomness and creativity.
 * Temperature affects output determinism and creativity levels, so validation ensures
 * the value falls within the expected 0-2 range where 0 is deterministic and 2 is highly creative.
 *
 * @param params - Request parameters requiring temperature validation
 * @returns True if parameters contain null or valid temperature value (0-2)
 */
export function hasValidTemperature(params: unknown): params is { temperature?: number } {
  if (!isObject(params)) {
    return false;
  }
  if (!("temperature" in params)) {
    return false;
  }
  const t = (params as { temperature?: unknown }).temperature;
  return typeof t === "number" && t >= 0 && t <= 2;
}

/**
 * Validates top_p parameter for controlling LLM response diversity through nucleus sampling.
 * Top_p affects response variety by sampling from the top probability tokens that sum to p,
 * so validation ensures the value is within the valid 0-1 range for proper sampling behavior.
 *
 * @param params - Request parameters requiring top_p validation
 * @returns True if parameters contain null or valid top_p value (0-1)
 */
export function hasValidTopP(params: unknown): params is { top_p?: number } {
  if (!isObject(params)) {
    return false;
  }
  if (!("top_p" in params)) {
    return false;
  }
  const p = (params as { top_p?: unknown }).top_p;
  return typeof p === "number" && p >= 0 && p <= 1;
}

/**
 * Validates maximum output token limits for controlling LLM response length.
 * Output token limits prevent runaway generation and ensure responses fit within
 * system constraints, so validation ensures positive numeric values for proper
 * length control.
 *
 * @param params - Request parameters requiring max output token validation
 * @returns True if parameters contain null or valid positive token limit
 */
export function hasValidMaxOutputTokens(params: unknown): params is { max_output_tokens?: number } {
  if (!isObject(params)) {
    return false;
  }
  if (!("max_output_tokens" in params)) {
    return false;
  }
  const m = (params as { max_output_tokens?: unknown }).max_output_tokens;
  return typeof m === "number" && m > 0;
}

/**
 * Validates reasoning configuration for controlling LLM reasoning depth and effort.
 * Reasoning parameters influence how deeply the LLM thinks through problems,
 * so validation ensures proper structure and effort level specification for
 * optimal reasoning behavior.
 *
 * @param params - Request parameters requiring reasoning configuration validation
 * @returns True if parameters contain null or valid reasoning configuration
 */
export function hasValidReasoning(params: unknown): params is { reasoning?: { effort?: string } } {
  if (!isObject(params)) {
    return false;
  }
  if (!("reasoning" in params)) {
    return false;
  }
  const reasoning = (params as { reasoning?: unknown }).reasoning;
  if (!isObject(reasoning)) {
    return false;
  }
  const eff = (reasoning as { effort?: unknown }).effort;
  return eff === undefined || typeof eff === "string";
}

/**
 * Validates that request parameters contain a properly structured tools array.
 * Tools enable LLMs to call external functions and services, so validation ensures
 * the tools parameter is an array of valid tool objects for proper tool processing.
 *
 * @param params - Request parameters requiring tools array validation
 * @returns True if parameters contain a valid tools array
 */
export function hasValidTools(params: unknown): params is { tools: Tool[] } {
  if (!isObject(params)) {
    return false;
  }
  if (!("tools" in params)) {
    return false;
  }
  if (!Array.isArray(params.tools)) {
    return false;
  }
  return params.tools.every((tool) => isObject(tool));
}

// Tool type guards

/**
 * Identifies function tools that enable LLM calls to custom user-defined functions.
 * Function tools are the most common tool type, allowing LLMs to invoke specific
 * functions with parameters. Essential for distinguishing function tools from
 * built-in tools like web search or code interpreter.
 *
 * @param tool - Tool object requiring function tool validation
 * @returns True if tool is a function tool with custom function definitions
 */
export function isFunctionTool(tool: Tool): tool is FunctionTool {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  return tool.type === "function";
}

/**
 * Identifies file search tools that enable LLM access to document retrieval capabilities.
 * File search tools allow LLMs to search through uploaded documents and files,
 * expanding their ability to work with user-provided content and knowledge bases.
 *
 * @param tool - Tool object requiring file search tool validation
 * @returns True if tool provides file search functionality
 */
export function isFileSearchTool(tool: Tool): tool is FileSearchTool {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  return tool.type === "file_search";
}

/**
 * Identifies web search tools that enable LLM access to real-time web information.
 * Web search tools allow LLMs to search the internet for current information,
 * expanding their knowledge beyond training data. Critical for enabling
 * information retrieval capabilities in LLM workflows.
 *
 * @param tool - Tool object requiring web search tool validation
 * @returns True if tool provides web search functionality
 */
export function isWebSearchTool(tool: Tool): tool is WebSearchTool {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  return tool.type === "web_search_preview" ? true : tool.type === "web_search_preview_2025_03_11";
}

/**
 * Identifies computer use tools that enable LLM interaction with computer interfaces.
 * Computer tools allow LLMs to control screens, click, type, and interact with
 * applications, enabling automation and computer vision capabilities.
 *
 * @param tool - Tool object requiring computer tool validation
 * @returns True if tool provides computer interaction functionality
 */
export function isComputerTool(tool: Tool): tool is ComputerTool {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  return tool.type === "computer_use_preview";
}

/**
 * Identifies custom tools that provide user-defined functionality beyond built-in tools.
 * Custom tools enable extending LLM capabilities with specialized functionality
 * tailored to specific use cases and requirements.
 *
 * @param tool - Tool object requiring custom tool validation
 * @returns True if tool is a custom user-defined tool
 */
export function isCustomTool(tool: Tool): tool is CustomTool {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  return tool.type === "custom";
}

/**
 * Identifies MCP (Model Context Protocol) tools for external service integration.
 * MCP tools enable LLMs to connect with external services and APIs through
 * the Model Context Protocol standard for enhanced capabilities.
 *
 * @param tool - Tool object requiring MCP tool validation
 * @returns True if tool provides MCP functionality
 */
export function isMcpTool(tool: Tool): tool is Tool.Mcp {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  return tool.type === "mcp";
}

/**
 * Identifies code interpreter tools that enable LLM execution of Python code.
 * Code interpreter tools allow LLMs to run code, perform calculations, and
 * generate visualizations. Essential for enabling computational capabilities
 * and data analysis within LLM workflows.
 *
 * @param tool - Tool object requiring code interpreter validation
 * @returns True if tool provides code execution functionality
 */
export function isCodeInterpreterTool(tool: Tool): tool is Tool.CodeInterpreter {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  return tool.type === "code_interpreter";
}

/**
 * Identifies built-in tools provided by the platform versus custom user-defined tools.
 * Built-in tools are pre-defined by the system and include capabilities like web search,
 * code interpretation, and file search. Essential for distinguishing platform tools
 * from user-defined function tools.
 *
 * @param tool - Tool object requiring built-in tool validation
 * @returns True if tool is a platform-provided built-in tool
 */
export function isBuiltinTool(tool: Tool): boolean {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  const builtinTypes = [
    "file_search",
    "web_search_preview",
    "web_search_preview_2025_03_11",
    "computer_use_preview",
    "code_interpreter",
    "image_generation",
    "local_shell",
  ];
  if (typeof tool.type !== "string") {
    return false;
  }
  return builtinTypes.includes(tool.type);
}

// Tool choice type guards

/**
 * Validates tool choice options for controlling LLM tool usage behavior.
 * Tool choice options determine when and how LLMs should use available tools,
 * from never using tools (none) to requiring tool usage (required).
 *
 * @param tc - Unknown value requiring tool choice option validation
 * @returns True if value is a valid tool choice option string
 */
export function isToolChoiceOption(tc: unknown): tc is "none" | "auto" | "required" {
  return tc === "none" ? true : tc === "auto" ? true : tc === "required";
}

/**
 * Validates allowed tools configuration for granular tool usage control.
 * Allowed tool choice enables specifying exactly which tools the LLM can use
 * and whether tool usage is required or optional within that subset.
 *
 * @param tc - Unknown value requiring allowed tools validation
 * @returns True if value is a valid allowed tools configuration
 */
export function isToolChoiceAllowed(tc: unknown): tc is ToolChoiceAllowed {
  if (!isObject(tc)) {
    return false;
  }
  if (!("type" in tc)) {
    return false;
  }
  if (tc.type !== "allowed_tools") {
    return false;
  }
  if (!("mode" in tc)) {
    return false;
  }
  if (tc.mode !== "auto" && tc.mode !== "required") {
    return false;
  }
  if (!("tools" in tc)) {
    return false;
  }
  return Array.isArray(tc.tools);
}

/**
 * Validates function tool choice for specifying exact function to use.
 * Function tool choice enables forcing the LLM to use a specific function tool,
 * providing precise control over tool selection in multi-tool scenarios.
 *
 * @param tc - Unknown value requiring function tool choice validation
 * @returns True if value is a valid function tool choice specification
 */
export function isToolChoiceFunction(tc: unknown): tc is ToolChoiceFunction {
  if (!isObject(tc)) {
    return false;
  }
  if (!("type" in tc)) {
    return false;
  }
  if (tc.type !== "function") {
    return false;
  }
  if (!("name" in tc)) {
    return false;
  }
  return typeof tc.name === "string";
}

/**
 * Validates custom tool choice for specifying exact custom tool to use.
 * Custom tool choice enables forcing the LLM to use a specific custom tool,
 * providing precise control over custom tool selection.
 *
 * @param tc - Unknown value requiring custom tool choice validation
 * @returns True if value is a valid custom tool choice specification
 */
export function isToolChoiceCustom(tc: unknown): tc is ToolChoiceCustom {
  if (!isObject(tc)) {
    return false;
  }
  if (!("type" in tc)) {
    return false;
  }
  if (tc.type !== "custom") {
    return false;
  }
  if (!("name" in tc)) {
    return false;
  }
  return typeof tc.name === "string";
}

// Response input type guards

/**
 * Validates response input message items for proper conversation structure.
 * Message input items contain the conversational content that forms the basis
 * of LLM interactions, requiring proper role and content validation.
 *
 * @param item - Response input item requiring message validation
 * @returns True if item is a valid message with proper role structure
 */
export function isResponseInputMessage(item: ResponseInputItem): boolean {
  if (!isObject(item)) {
    return false;
  }
  if (!("type" in item)) {
    return false;
  }
  if (item.type !== "message") {
    return false;
  }
  if (!("role" in item)) {
    return false;
  }
  return item.role === "user" || item.role === "system" || item.role === "developer" || item.role === "assistant";
}

/**
 * Validates response input tool call items for tool execution processing.
 * Tool call input items represent function calls and their results within
 * the conversation flow, requiring proper type and structure validation.
 *
 * @param item - Response input item requiring tool call validation
 * @returns True if item represents a tool call or tool call output
 */
export function isResponseInputToolCall(item: ResponseInputItem): boolean {
  if (!isObject(item)) {
    return false;
  }
  if (!("type" in item)) {
    return false;
  }
  if (typeof item.type !== "string") {
    return false;
  }
  return item.type.endsWith("_call") ? true : item.type.endsWith("_call_output");
}

// Response format type guards

/**
 * Validates response format configuration for structured output requirements.
 * Response format enables requesting JSON schema-validated responses from LLMs,
 * ensuring outputs match specific structural requirements for downstream processing.
 *
 * @param text - Unknown value requiring response format validation
 * @returns True if value contains valid JSON schema response format configuration
 */
export function hasResponseFormat(text: unknown): text is ResponseTextConfig & {
  response_format: {
    type: "json_schema";
    json_schema: {
      name?: string;
      description?: string;
      schema?: unknown;
    };
  };
} {
  if (!isObject(text)) {
    return false;
  }
  if (!("response_format" in text)) {
    return false;
  }
  if (!isObject(text.response_format)) {
    return false;
  }
  if (!("type" in text.response_format)) {
    return false;
  }
  if (text.response_format.type !== "json_schema") {
    return false;
  }
  if (!("json_schema" in text.response_format)) {
    return false;
  }
  return isObject(text.response_format.json_schema);
}

// Response input message type guards

/**
 * Validates message input structure for conversation processing.
 * Message inputs form the core of conversational AI interactions,
 * requiring proper role assignment and content format validation.
 *
 * @param item - Unknown item requiring message input validation
 * @returns True if item is a properly structured message input
 */
export function isMessageInput(item: unknown): item is {
  type: "message";
  role: "user" | "system" | "developer" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
} {
  if (!isObject(item)) {
    return false;
  }
  if (!("type" in item)) {
    return false;
  }
  if (item.type !== "message") {
    return false;
  }
  if (!("role" in item)) {
    return false;
  }
  if (typeof item.role !== "string") {
    return false;
  }
  if (!["user", "system", "developer", "assistant"].includes(item.role)) {
    return false;
  }
  if (!("content" in item)) {
    return false;
  }
  return typeof item.content === "string" ? true : Array.isArray(item.content);
}

/**
 * Validates text input structure for simple text processing.
 * Text inputs provide a simple format for sending plain text content
 * to LLMs without complex message structuring.
 *
 * @param item - Unknown item requiring text input validation
 * @returns True if item is a properly structured text input
 */
export function isTextInput(item: unknown): item is {
  type: "input_text";
  text: string;
} {
  if (!isObject(item)) {
    return false;
  }
  if (!("type" in item)) {
    return false;
  }
  if (item.type !== "input_text") {
    return false;
  }
  if (!("text" in item)) {
    return false;
  }
  return typeof item.text === "string";
}

/**
 * Validates content part structure within message content arrays.
 * Content parts are building blocks of complex messages that can contain
 * text, images, or other media types within structured message content.
 *
 * @param part - Unknown part requiring content part validation
 * @returns True if part has valid content part structure
 */
export function isContentPart(part: unknown): part is { type: string; text?: string } {
  if (!isObject(part)) {
    return false;
  }
  if (!("type" in part)) {
    return false;
  }
  return typeof part.type === "string";
}

/**
 * Validates text content parts within structured message content.
 * Text content parts contain the textual content within complex message
 * structures, requiring specific text type and content validation.
 *
 * @param part - Unknown part requiring text content part validation
 * @returns True if part is a valid text content part with string content
 */
export function isTextContentPart(part: unknown): part is { type: "text"; text: string } {
  if (!isContentPart(part)) {
    return false;
  }
  if (part.type !== "text") {
    return false;
  }
  if (!("text" in part)) {
    return false;
  }
  return typeof part.text === "string";
}

// Tool-related type guards for testing (removed duplicates)

/**
 * Validates function tools with proper name specification for tool processing.
 * Function tools with names enable specific tool identification and invocation
 * within LLM workflows, requiring both function type and name validation.
 *
 * @param tool - Unknown tool requiring named function tool validation
 * @returns True if tool is a function tool with a valid string name
 */
export function isFunctionToolWithName(tool: unknown): tool is FunctionTool {
  if (!isObject(tool)) {
    return false;
  }
  if (!("type" in tool)) {
    return false;
  }
  if (tool.type !== "function") {
    return false;
  }
  if (!("name" in tool)) {
    return false;
  }
  return typeof tool.name === "string";
}
