/**
 * @file Type guards for OpenAI Responses API ResponseItem union types
 *
 * Why: Provides comprehensive type guards for all ResponseItem union members
 * to ensure type safety when handling different response item types.
 */

import type {
  ResponseItem,
  ResponseInputMessageItem,
  ResponseOutputMessage,
  ResponseFileSearchToolCall,
  ResponseComputerToolCall,
  ResponseComputerToolCallOutputItem,
  ResponseFunctionWebSearch,
  ResponseFunctionToolCallItem,
  ResponseFunctionToolCallOutputItem,
  ResponseCodeInterpreterToolCall,
} from "openai/resources/responses/responses";

/**
 * Checks if a ResponseItem is a ResponseInputMessageItem.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseInputMessageItem
 */
export function isResponseInputMessageItem(item: ResponseItem): item is ResponseInputMessageItem {
  if (item.type !== "message") {
    return false;
  }
  return "role" in item;
}

/**
 * Checks if a ResponseItem is a ResponseOutputMessage.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseOutputMessage
 */
export function isResponseOutputMessageItem(item: ResponseItem): item is ResponseOutputMessage {
  if (item.type !== "message") {
    return false;
  }
  return !("role" in item);
}

/**
 * Checks if a ResponseItem is a ResponseFileSearchToolCall.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseFileSearchToolCall
 */
export function isResponseFileSearchToolCall(item: ResponseItem): item is ResponseFileSearchToolCall {
  return item.type === "file_search_call";
}

/**
 * Checks if a ResponseItem is a ResponseComputerToolCall.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseComputerToolCall
 */
export function isResponseComputerToolCall(item: ResponseItem): item is ResponseComputerToolCall {
  return item.type === "computer_call";
}

/**
 * Checks if a ResponseItem is a ResponseComputerToolCallOutputItem.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseComputerToolCallOutputItem
 */
export function isResponseComputerToolCallOutputItem(item: ResponseItem): item is ResponseComputerToolCallOutputItem {
  return item.type === "computer_call_output";
}

/**
 * Checks if a ResponseItem is a ResponseFunctionWebSearch.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseFunctionWebSearch
 */
export function isResponseFunctionWebSearch(item: ResponseItem): item is ResponseFunctionWebSearch {
  return item.type === "web_search_call";
}

/**
 * Checks if a ResponseItem is a ResponseFunctionToolCallItem.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseFunctionToolCallItem
 */
export function isResponseFunctionToolCallItem(item: ResponseItem): item is ResponseFunctionToolCallItem {
  if (item.type !== "function_call") {
    return false;
  }
  const hasId = "id" in item;
  const hasCallId = "call_id" in item;
  if (!hasId) {
    return false;
  }
  return hasCallId;
}

/**
 * Checks if a ResponseItem is a ResponseFunctionToolCallOutputItem.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseFunctionToolCallOutputItem
 */
export function isResponseFunctionToolCallOutputItem(item: ResponseItem): item is ResponseFunctionToolCallOutputItem {
  return item.type === "function_call_output";
}

/**
 * Checks if a ResponseItem is an image generation call.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseItem.ImageGenerationCall
 */
export function isResponseImageGenerationCall(item: ResponseItem): item is ResponseItem.ImageGenerationCall {
  return item.type === "image_generation_call";
}

/**
 * Checks if a ResponseItem is a ResponseCodeInterpreterToolCall.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseCodeInterpreterToolCall
 */
export function isResponseCodeInterpreterToolCall(item: ResponseItem): item is ResponseCodeInterpreterToolCall {
  return item.type === "code_interpreter_call";
}

/**
 * Checks if a ResponseItem is a local shell call.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseItem.LocalShellCall
 */
export function isResponseLocalShellCall(item: ResponseItem): item is ResponseItem.LocalShellCall {
  return item.type === "local_shell_call";
}

/**
 * Checks if a ResponseItem is a local shell call output.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseItem.LocalShellCallOutput
 */
export function isResponseLocalShellCallOutput(item: ResponseItem): item is ResponseItem.LocalShellCallOutput {
  return item.type === "local_shell_call_output";
}

/**
 * Checks if a ResponseItem is an MCP list tools.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseItem.McpListTools
 */
export function isResponseMcpListTools(item: ResponseItem): item is ResponseItem.McpListTools {
  return item.type === "mcp_list_tools";
}

/**
 * Checks if a ResponseItem is an MCP approval request.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseItem.McpApprovalRequest
 */
export function isResponseMcpApprovalRequest(item: ResponseItem): item is ResponseItem.McpApprovalRequest {
  return item.type === "mcp_approval_request";
}

/**
 * Checks if a ResponseItem is an MCP approval response.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseItem.McpApprovalResponse
 */
export function isResponseMcpApprovalResponse(item: ResponseItem): item is ResponseItem.McpApprovalResponse {
  return item.type === "mcp_approval_response";
}

/**
 * Checks if a ResponseItem is an MCP call.
 * @param item - The ResponseItem to validate
 * @returns True if item is ResponseItem.McpCall
 */
export function isResponseMcpCall(item: ResponseItem): item is ResponseItem.McpCall {
  return item.type === "mcp_call";
}
