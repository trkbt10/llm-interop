/**
 * @file Handlers for converting individual ResponseInputItem variants
 */

import type {
  ResponseInputItem,
} from "openai/resources/responses/responses";
import type {
  GeminiContent as ClientGeminiContent,
} from "../../../providers/gemini/client/fetch-client";
import {
  isResponseInputCustomToolCall,
  isResponseInputCustomToolCallOutput,
  isResponseInputFileSearchToolCall,
  isResponseInputImageGenerationCall,
  isResponseInputCodeInterpreterToolCall,
  isResponseInputComputerToolCall,
  isResponseInputLocalShellCall,
  isResponseInputLocalShellCallOutput,
  isResponseInputMcpCall,
  isResponseInputMcpApprovalRequest,
  isResponseInputMcpApprovalResponse,
  isResponseInputMcpListTools,
  isResponseInputItemReference,
  isResponseInputFunctionToolCall,
  isResponseInputFunctionCallOutput,
} from "../../../providers/openai/responses-guards";
import { isObject } from "../../../utils/type-guards";
import { fnCall, parseArgs } from "./utils";

/** Resolver for mapping tool call IDs to function names */
export type ToolNameResolver = (callId: string) => string | undefined;

/**
 * Convert a single ResponseInputItem to a Gemini content structure.
 * Returns undefined when the item type is not directly supported here.
 */
export function convertItemToGeminiContent(
  item: ResponseInputItem,
  resolveToolName?: ToolNameResolver,
): ClientGeminiContent | undefined {
  if (isResponseInputFunctionCallOutput(item)) {
    const name = resolveToolName ? resolveToolName(item.call_id) : undefined;
    if (name) {
      return { role: "function", parts: [{ functionResponse: { name, response: item.output } }] } as ClientGeminiContent;
    }
    return undefined;
  }

  if (isResponseInputFunctionToolCall(item)) {
    const args = parseArgs((item as { arguments?: unknown }).arguments);
    const providedName = (item as { name?: unknown }).name;
    const fnName = typeof providedName === "string" ? providedName : "function";
    const part = fnCall(fnName, args);
    return { role: "user", parts: [part] } as ClientGeminiContent;
  }

  if (isResponseInputCustomToolCall(item)) {
    const args = parseArgs((item as { arguments?: unknown }).arguments);
    const providedName = (item as { name?: unknown }).name;
    const name = typeof providedName === "string" ? providedName : "custom_tool";
    return { role: "user", parts: [fnCall(name, args)] } as ClientGeminiContent;
  }

  if (isResponseInputCustomToolCallOutput(item)) {
    const providedName = (item as { name?: unknown }).name;
    const name = typeof providedName === "string" ? providedName : "custom_tool";
    return { role: "function", parts: [{ functionResponse: { name, response: (item as { output?: unknown }).output } }] } as ClientGeminiContent;
  }

  if (isResponseInputFileSearchToolCall(item)) {
    const query = (item as { query?: unknown }).query;
    const args = typeof query === "string" ? { query } : undefined;
    return { role: "user", parts: [fnCall("web_search", args)] } as ClientGeminiContent;
  }

  if (isResponseInputImageGenerationCall(item)) {
    const prompt = (item as { prompt?: unknown }).prompt;
    const args = typeof prompt === "string" ? { prompt } : undefined;
    return { role: "user", parts: [fnCall("generate_image", args)] } as ClientGeminiContent;
  }

  if (isResponseInputCodeInterpreterToolCall(item)) {
    const code = (item as { code?: unknown }).code;
    const args = typeof code === "string" ? { code } : parseArgs(code);
    return { role: "user", parts: [fnCall("code_interpreter", args)] } as ClientGeminiContent;
  }

  if (isResponseInputComputerToolCall(item)) {
    const spec = isObject(item) ? (item as Record<string, unknown>) : undefined;
    const args = spec ? { ...spec } : undefined;
    return { role: "user", parts: [fnCall("computer_call", args)] } as ClientGeminiContent;
  }

  if (isResponseInputLocalShellCall(item)) {
    const cmd = (item as { command?: unknown }).command;
    const args = typeof cmd === "string" ? { command: cmd } : undefined;
    return { role: "user", parts: [fnCall("local_shell", args)] } as ClientGeminiContent;
  }

  if (isResponseInputLocalShellCallOutput(item)) {
    return { role: "function", parts: [{ functionResponse: { name: "local_shell", response: (item as { output?: unknown }).output } }] } as ClientGeminiContent;
  }

  if (isResponseInputMcpCall(item)) {
    const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
    return { role: "user", parts: [fnCall("mcp_call", args)] } as ClientGeminiContent;
  }

  if (isResponseInputMcpApprovalRequest(item)) {
    const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
    return { role: "user", parts: [fnCall("mcp_approval_request", args)] } as ClientGeminiContent;
  }

  if (isResponseInputMcpApprovalResponse(item)) {
    const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
    return { role: "user", parts: [fnCall("mcp_approval_response", args)] } as ClientGeminiContent;
  }

  if (isResponseInputMcpListTools(item)) {
    return { role: "user", parts: [fnCall("mcp_list_tools")] } as ClientGeminiContent;
  }

  if (isResponseInputItemReference(item)) {
    const id = (item as { id?: unknown }).id;
    const refText = typeof id === "string" ? `[ref:${id}]` : "[ref]";
    return { role: "user", parts: [{ text: refText }] } as ClientGeminiContent;
  }

  return undefined;
}
