/**
 * @file Converts OpenAI chat completion inputs to OpenAI Responses API input format
 */
import type {
  ResponseInput,
  ResponseInputItem,
  ResponseInputImage,
  ResponseInputMessageContentList,
} from "openai/resources/responses/responses";
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";
import {
  isEasyInputMessage,
  isFunctionToolCallOutput,
  isInputText,
  isInputImage,
  isResponseInputOutputMessage,
  isResponseInputFunctionToolCall,
} from "../../../../providers/openai/responses-guards";

/**
 * Converts ResponseInput to chat completion messages
 */
export const convertResponseInputToMessages = (input: ResponseInput): ChatCompletionMessageParam[] => {
  const messages: ChatCompletionMessageParam[] = [];

  if (Array.isArray(input)) {
    // Handle array of ResponseInputItem
    for (const item of input) {
      const converted = convertInputItem(item);
      if (converted) {
        messages.push(...converted);
      }
    }
    return messages;
  }

  if (input && typeof input === "object") {
    // Handle single ResponseInputItem or structured input
    const converted = convertInputItem(input);
    if (converted) {
      messages.push(...converted);
    }
  }

  return messages;
};

/**
 * Converts a single ResponseInputItem to chat messages
 */
const convertInputItem = (item: ResponseInputItem): ChatCompletionMessageParam[] => {
  const messages: ChatCompletionMessageParam[] = [];

  // Handle EasyInputMessage
  if (isEasyInputMessage(item)) {
    // Handle each role type separately for proper typing
    const role = item.role;
    if (role === "system") {
      const convertedContent = typeof item.content === "string" ? item.content : convertContentList(item.content);
      messages.push({
        role: "system",
        content: collapseToText(convertedContent),
      });
      return messages;
    }

    if (role === "user") {
      const convertedContent = typeof item.content === "string" ? item.content : convertContentList(item.content);
      messages.push({
        role: "user",
        content: convertedContent,
      });
      return messages;
    }

    if (role === "assistant") {
      const convertedContent = typeof item.content === "string" ? item.content : convertContentList(item.content);
      messages.push({
        role: "assistant",
        content: collapseToText(convertedContent),
      });
    }
    return messages;
  }

  // Handle ResponseOutputMessage (assistant messages from previous turns)
  if (isResponseInputOutputMessage(item)) {
    const content = item.content
      .map((c) => {
        if ("text" in c) {
          return c.text;
        }
        return "";
      })
      .join("");

    messages.push({
      role: "assistant",
      content,
    });
    return messages;
  }

  // Handle function tool calls
  if (isResponseInputFunctionToolCall(item)) {
    // Function calls are typically part of assistant messages
    // We need to handle this specially
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: item.call_id,
          type: "function",
          function: {
            name: item.name,
            arguments: item.arguments,
          },
        },
      ],
    });
    return messages;
  }

  // Handle function tool call outputs
  if (isFunctionToolCallOutput(item)) {
    const convertedOutput = typeof item.output === "string" ? item.output : convertContentList(item.output);
    messages.push({
      role: "tool",
      content: typeof convertedOutput === "string" ? convertedOutput : collapseToText(convertedOutput),
      tool_call_id: item.call_id,
    });
    return messages;
  }

  // Handle other item types as needed
  // For now, we'll skip unsupported types
  return messages;
};

// Use OpenAI's native content part types directly

/**
 * Converts ResponseInputMessageContentList to chat content
 */
const convertContentList = (content: ResponseInputMessageContentList): string | ChatCompletionContentPart[] => {
  const parts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
  > = [];

  for (const item of content) {
    if (isInputText(item)) {
      parts.push({
        type: "text",
        text: item.text,
      });
      continue;
    }

    if (isInputImage(item)) {
      parts.push({
        type: "image_url",
        image_url: {
          url: getImageUrl(item),
          detail: getImageDetail(item),
        },
      });
    }
    // Add more content types as needed
  }

  // If all parts are text, return as string
  if (parts.every((p) => p.type === "text")) {
    return parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  }

  return parts;
};

// Helper functions for type safety
const getImageUrl = (item: ResponseInputImage): string => {
  if (item.image_url && typeof item.image_url === "string") {
    return item.image_url;
  }
  return "";
};

const getImageDetail = (item: ResponseInputImage): "auto" | "low" | "high" => {
  return item.detail ?? "auto";
};

// Collapse content parts or string to a single string
const collapseToText = (content: string | ChatCompletionContentPart[]): string => {
  if (typeof content === "string") {
    return content;
  }
  return content.map((p) => (p.type === "text" ? p.text : "")).join("");
};
