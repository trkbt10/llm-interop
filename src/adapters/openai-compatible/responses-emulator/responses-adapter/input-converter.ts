/**
 * @file Converts OpenAI chat completion inputs to OpenAI Responses API input format
 */
import type {
  ResponseInput,
  ResponseInputItem,
  ResponseInputImage,
  ResponseOutputMessage,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";
import {
  isEasyInputMessage,
  isFunctionToolCallOutput,
  isInputText,
  isInputImage,
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
    const converted = convertInputItem(input as ResponseInputItem);
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
    const convertedContent =
      typeof item.content === "string" ? item.content : convertContentList(item.content as unknown[]);

    // Handle each role type separately for proper typing
    const role = item.role;
    if (role === "system") {
      messages.push({
        role: "system",
        content: collapseToText(convertedContent),
      });
      return messages;
    }

    if (role === "user") {
      messages.push({
        role: "user",
        content: convertedContent,
      });
      return messages;
    }

    if (role === "assistant") {
      messages.push({
        role: "assistant",
        content: collapseToText(convertedContent),
      });
    }
    return messages;
  }

  // Handle ResponseOutputMessage (assistant messages from previous turns)
  if (isResponseOutputMessage(item)) {
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
  if (isFunctionToolCall(item)) {
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
    messages.push({
      role: "tool",
      content: item.output,
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
const convertContentList = (content: unknown[]): string | ChatCompletionContentPart[] => {
  const parts: ChatCompletionContentPart[] = [];

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
  const iu = (item as { image_url?: unknown }).image_url;
  if (typeof iu === "string") {
    return iu;
  }
  if (iu) {
    if (typeof iu === "object") {
      if ("url" in (iu as Record<string, unknown>)) {
        const url = (iu as { url?: unknown }).url;
        if (typeof url === "string") {
          return url;
        }
        return "";
      }
    }
  }
  return "";
};

const getImageDetail = (item: ResponseInputImage): "auto" | "low" | "high" => {
  const iu = (item as { image_url?: unknown }).image_url;
  if (iu) {
    if (typeof iu === "object") {
      if ("detail" in (iu as Record<string, unknown>)) {
        const d = (iu as { detail?: unknown }).detail;
        if (d === "auto" || d === "low" || d === "high") {
          return d;
        }
      }
    }
  }
  return "auto";
};

// Local type guards (different from centralized ones)

const isResponseOutputMessage = (item: unknown): item is ResponseOutputMessage => {
  if (!item) {
    return false;
  }
  if (typeof item !== "object") {
    return false;
  }
  if ((item as unknown as { type: string }).type !== "message") {
    return false;
  }
  if (!("content" in item)) {
    return false;
  }
  return Array.isArray((item as unknown as { content: unknown }).content);
};

const isFunctionToolCall = (item: unknown): item is ResponseFunctionToolCall => {
  if (!item) {
    return false;
  }
  if (typeof item !== "object") {
    return false;
  }
  if ((item as unknown as { type: string }).type !== "function_call") {
    return false;
  }
  if (!("name" in item)) {
    return false;
  }
  return "arguments" in item;
};

// Collapse content parts or string to a single string
const collapseToText = (content: string | ChatCompletionContentPart[]): string => {
  if (typeof content === "string") {
    return content;
  }
  return content.map((p) => (p.type === "text" ? p.text : "")).join("");
};
