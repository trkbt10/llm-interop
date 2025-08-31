/**
 * @file Converts OpenAI non-streaming responses to Claude message format.
 * Handles synchronous response transformation including tool calls and content blocks.
 */

import type { Response as OpenAIResponse, ResponseOutputText } from "openai/resources/responses/responses";
import type { Message as ClaudeMessage, ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import { isResponseOutputText } from "../../providers/claude/guards";
import { isResponseFunctionToolCall, isResponseOutputMessage } from "../../providers/openai/responses-guards";

function convertResponseToClaudeContent(resp: OpenAIResponse): ContentBlock[] {
  const content: ContentBlock[] = [];

  if (!Array.isArray(resp.output)) {
    return content;
  }

  for (const item of resp.output) {
    if (isResponseOutputMessage(item)) {
      // Handle text content from message items
      const textParts = (Array.isArray(item.content) ? item.content : []).filter((c): c is ResponseOutputText =>
        isResponseOutputText(c),
      );
      for (const textPart of textParts) {
        if (textPart.text) {
          content.push({
            type: "text",
            text: textPart.text,
            citations: null,
          });
        }
      }
    } else if (isResponseFunctionToolCall(item)) {
      // Convert function calls to Claude tool_use blocks
      const input = parseToolUseInput(item.arguments);
      content.push({
        type: "tool_use",
        id: item.call_id ? item.call_id : item.id ? item.id : `tool_${Date.now()}`,
        name: typeof item.name === "string" ? item.name : "",
        input,
      });
    }
    // Note: Other tool types like web_search_call, image_generation_call, code_interpreter_call
    // would also be converted to tool_use blocks if they were present in the response
  }

  return content;
}

function buildClaudeMessage(resp: OpenAIResponse, messageId: string, model: string): ClaudeMessage {
  const content = convertResponseToClaudeContent(resp);

  // Determine stop reason
  const hasTools = content.some((c) => c.type === "tool_use");
  function computeStopReason(): "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" {
    if (resp.status === "incomplete" && resp.incomplete_details?.reason === "max_output_tokens") {
      return "max_tokens";
    }
    if (hasTools) {
      return "tool_use";
    }
    return "end_turn";
  }
  const stop_reason = computeStopReason();

  // Handle usage information
  const defaultUsage = { input_tokens: 0, output_tokens: 0 };
  const usage = resp.usage ? resp.usage : defaultUsage;

  return {
    id: messageId,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
      output_tokens: typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      cache_creation: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

function parseToolUseInput(argumentsString?: string): unknown {
  if (!argumentsString) {
    return {};
  }
  try {
    return JSON.parse(argumentsString);
  } catch {
    return {};
  }
}

/**
 * Converts OpenAI non-streaming response to Claude message format.
 */
export function openAINonStreamToClaudeMessage(resp: OpenAIResponse, messageId: string, model: string): ClaudeMessage {
  return buildClaudeMessage(resp, messageId, model);
}
