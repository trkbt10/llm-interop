/**
 * @file Type guards for OpenAI Responses API ResponseInputItem union types
 *
 * Why: Provides comprehensive type guards for all ResponseInputItem union members
 * to ensure type safety when handling different input item types.
 */

import type {
  ResponseInputItem,
  EasyInputMessage,
  ResponseOutputMessage,
  ResponseFileSearchToolCall,
  ResponseComputerToolCall,
  ResponseFunctionWebSearch,
  ResponseFunctionToolCall,
  ResponseReasoningItem,
  ResponseCodeInterpreterToolCall,
  ResponseCustomToolCallOutput,
  ResponseCustomToolCall,
} from "openai/resources/responses/responses";

/**
 * Checks if a ResponseInputItem is an EasyInputMessage.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is EasyInputMessage
 */
export function isResponseEasyInputMessage(item: ResponseInputItem): item is EasyInputMessage {
  // EasyInputMessage has role and content, but no explicit type field
  if ("type" in item && item.type === "message") {
    if ("role" in item && "content" in item) {
      return true;
    }
    return false;
  }
  // For implicit message types
  const hasRole = "role" in item;
  const hasContent = "content" in item;
  const hasType = "type" in item;
  if (!hasRole) {
    return false;
  }
  if (!hasContent) {
    return false;
  }
  if (hasType) {
    return false;
  }
  return true;
}

/**
 * Checks if a ResponseInputItem is a ResponseInputItem.Message.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.Message
 */
export function isResponseInputMessage(item: ResponseInputItem): item is ResponseInputItem.Message {
  if (item.type !== "message") {
    return false;
  }
  return "role" in item;
}

/**
 * Checks if a ResponseInputItem is a ResponseOutputMessage.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseOutputMessage
 */
export function isResponseInputOutputMessage(item: ResponseInputItem): item is ResponseOutputMessage {
  if (item.type !== "message") {
    return false;
  }
  return !("role" in item);
}

/**
 * Checks if a ResponseInputItem is a ResponseFileSearchToolCall.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseFileSearchToolCall
 */
export function isResponseInputFileSearchToolCall(item: ResponseInputItem): item is ResponseFileSearchToolCall {
  return item.type === "file_search_call";
}

/**
 * Checks if a ResponseInputItem is a ResponseComputerToolCall.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseComputerToolCall
 */
export function isResponseInputComputerToolCall(item: ResponseInputItem): item is ResponseComputerToolCall {
  return item.type === "computer_call";
}

/**
 * Checks if a ResponseInputItem is a ResponseInputItem.ComputerCallOutput.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.ComputerCallOutput
 */
export function isResponseInputComputerCallOutput(item: ResponseInputItem): item is ResponseInputItem.ComputerCallOutput {
  return item.type === "computer_call_output";
}

/**
 * Checks if a ResponseInputItem is a ResponseFunctionWebSearch.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseFunctionWebSearch
 */
export function isResponseInputFunctionWebSearch(item: ResponseInputItem): item is ResponseFunctionWebSearch {
  return item.type === "web_search_call";
}

/**
 * Checks if a ResponseInputItem is a ResponseFunctionToolCall.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseFunctionToolCall
 */
export function isResponseInputFunctionToolCall(item: ResponseInputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

/**
 * Checks if a ResponseInputItem is a ResponseInputItem.FunctionCallOutput.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.FunctionCallOutput
 */
export function isResponseInputFunctionCallOutput(item: ResponseInputItem): item is ResponseInputItem.FunctionCallOutput {
  return item.type === "function_call_output";
}

/**
 * Checks if a ResponseInputItem is a ResponseReasoningItem.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseReasoningItem
 */
export function isResponseInputReasoningItem(item: ResponseInputItem): item is ResponseReasoningItem {
  return item.type === "reasoning";
}

/**
 * Checks if a ResponseInputItem is an image generation call.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.ImageGenerationCall
 */
export function isResponseInputImageGenerationCall(item: ResponseInputItem): item is ResponseInputItem.ImageGenerationCall {
  return item.type === "image_generation_call";
}

/**
 * Checks if a ResponseInputItem is a ResponseCodeInterpreterToolCall.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseCodeInterpreterToolCall
 */
export function isResponseInputCodeInterpreterToolCall(item: ResponseInputItem): item is ResponseCodeInterpreterToolCall {
  return item.type === "code_interpreter_call";
}

/**
 * Checks if a ResponseInputItem is a local shell call.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.LocalShellCall
 */
export function isResponseInputLocalShellCall(item: ResponseInputItem): item is ResponseInputItem.LocalShellCall {
  return item.type === "local_shell_call";
}

/**
 * Checks if a ResponseInputItem is a local shell call output.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.LocalShellCallOutput
 */
export function isResponseInputLocalShellCallOutput(item: ResponseInputItem): item is ResponseInputItem.LocalShellCallOutput {
  return item.type === "local_shell_call_output";
}

/**
 * Checks if a ResponseInputItem is an MCP list tools.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.McpListTools
 */
export function isResponseInputMcpListTools(item: ResponseInputItem): item is ResponseInputItem.McpListTools {
  return item.type === "mcp_list_tools";
}

/**
 * Checks if a ResponseInputItem is an MCP approval request.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.McpApprovalRequest
 */
export function isResponseInputMcpApprovalRequest(item: ResponseInputItem): item is ResponseInputItem.McpApprovalRequest {
  return item.type === "mcp_approval_request";
}

/**
 * Checks if a ResponseInputItem is an MCP approval response.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.McpApprovalResponse
 */
export function isResponseInputMcpApprovalResponse(item: ResponseInputItem): item is ResponseInputItem.McpApprovalResponse {
  return item.type === "mcp_approval_response";
}

/**
 * Checks if a ResponseInputItem is an MCP call.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.McpCall
 */
export function isResponseInputMcpCall(item: ResponseInputItem): item is ResponseInputItem.McpCall {
  return item.type === "mcp_call";
}

/**
 * Checks if a ResponseInputItem is a ResponseCustomToolCallOutput.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseCustomToolCallOutput
 */
export function isResponseInputCustomToolCallOutput(item: ResponseInputItem): item is ResponseCustomToolCallOutput {
  return item.type === "custom_tool_call_output";
}

/**
 * Checks if a ResponseInputItem is a ResponseCustomToolCall.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseCustomToolCall
 */
export function isResponseInputCustomToolCall(item: ResponseInputItem): item is ResponseCustomToolCall {
  return item.type === "custom_tool_call";
}

/**
 * Checks if a ResponseInputItem is an item reference.
 * @param item - The ResponseInputItem to validate
 * @returns True if item is ResponseInputItem.ItemReference
 */
export function isResponseInputItemReference(item: ResponseInputItem): item is ResponseInputItem.ItemReference {
  return item.type === "item_reference";
}
