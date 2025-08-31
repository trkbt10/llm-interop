/**
 * @file Tool result conversion utilities for Claude to OpenAI Response API transformation
 * Handles conversion of Claude tool execution results to OpenAI function call output format
 */
import type { ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { ResponseFunctionToolCallOutputItem } from "openai/resources/responses/responses";
import { toOpenAICallIdFromClaude, toOpenAIFunctionCallIdFromClaude } from "../../conversation/id-conversion";

/**
 * Converts Claude tool execution results into OpenAI function call output format.
 * Bridges the gap between Claude's tool result structure and OpenAI's function call
 * output expectations, ensuring tool execution chains work correctly across provider
 * boundaries. Essential for maintaining tool interaction continuity.
 *
 * @param block - Claude tool result block containing execution output and tool reference
 * @returns OpenAI-compatible function call output with proper ID mapping and result formatting
 */
export function convertToolResult(block: ToolResultBlockParam): ResponseFunctionToolCallOutputItem {
  const callId = toOpenAICallIdFromClaude(block.tool_use_id);
  const id = toOpenAIFunctionCallIdFromClaude(block.tool_use_id);
  const output = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
  return { id, type: "function_call_output", call_id: callId, output };
}
