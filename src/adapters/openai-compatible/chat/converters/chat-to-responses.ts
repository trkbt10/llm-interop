/**
 * @file Helpers that translate Chat Completions payloads into Responses API shapes.
 */

import type { ChatCompletionCreateParams, ChatCompletionContentPart } from "openai/resources/chat/completions";
import type {
  FunctionTool,
  ResponseCreateParams,
  ResponseInputItem,
  ResponseInputMessageContentList,
  Tool,
} from "openai/resources/responses/responses";
import {
  isOpenAIChatTextPart,
  isOpenAIChatFunctionTool,
  isOpenAIChatFunctionToolChoice,
  isOpenAIChatBasicRole,
} from "../../../../providers/openai/chat-guards";
import { convertOpenAIChatToolToResponsesTool } from "../../../shared/openai-tool-converters";
import { isObject } from "../../../../utils/type-guards";

/**
 * Extracts plain text from the flexible `message.content` field.
 */
export function extractTextFromContent(content: ChatCompletionCreateParams["messages"][number]["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const texts = (content as ChatCompletionContentPart[])
      .map((part) => (isOpenAIChatTextPart(part) ? part.text : ""))
      .filter(Boolean);
    return texts.join("");
  }
  return "";
}

/**
 * Converts chat function tool definitions into Responses-compatible function tools.
 */
export function mapChatToolsToResponses(tools: ChatCompletionCreateParams["tools"] | undefined): Tool[] | undefined {
  if (!Array.isArray(tools)) {
    return undefined;
  }
  const output: Tool[] = [];
  for (const tool of tools) {
    if (!isOpenAIChatFunctionTool(tool)) {
      continue;
    }
    const raw = (tool.function as { parameters?: unknown }).parameters;
    const parameters = isObject(raw) ? (raw as Record<string, unknown>) : undefined;
    const description = typeof tool.function.description === "string" ? tool.function.description : undefined;
    const normalized: FunctionTool = {
      type: "function",
      name: tool.function.name,
      strict: false,
      parameters: parameters ?? null,
      description: description ?? null,
    };
    output.push(normalized);
  }
  return output.length > 0 ? output : undefined;
}

export { convertOpenAIChatToolToResponsesTool };

/**
 * Normalises the chat `tool_choice` field for the Responses API.
 */
export function mapChatToolChoiceToResponses(
  toolChoice: ChatCompletionCreateParams["tool_choice"] | undefined,
): ResponseCreateParams["tool_choice"] | undefined {
  if (!toolChoice) {
    return undefined;
  }
  if (toolChoice === "auto" || toolChoice === "none" || toolChoice === "required") {
    return toolChoice;
  }
  if (isOpenAIChatFunctionToolChoice(toolChoice) && isObject((toolChoice as { function?: unknown }).function)) {
    const name = (toolChoice as { function: { name?: unknown } }).function.name;
    if (typeof name === "string") {
      return { type: "function", name };
    }
  }
  return undefined;
}

/**
 * Converts chat messages into Responses `response.input` items.
 */
export function buildResponseInputFromChatMessages(
  messages: ChatCompletionCreateParams["messages"] | undefined,
): ResponseInputItem[] {
  const normalized = Array.isArray(messages) ? messages : [];
  const items: ResponseInputItem[] = [];

  for (const message of normalized) {
    const text = extractTextFromContent(message.content);
    if (!isOpenAIChatBasicRole(message.role)) {
      continue;
    }
    const content = buildMessageContent(text);
    items.push({ type: "message", role: message.role, content });
  }

  return items;
}

function buildMessageContent(text: string | undefined): ResponseInputMessageContentList {
  if (!text) {
    return [];
  }
  return [
    {
      type: "input_text",
      text,
    },
  ];
}
