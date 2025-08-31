/**
 * @file Type guard functions for Claude/Anthropic API data structures and OpenAI compatibility.
 * Provides runtime type checking for Claude stream events, content blocks, messages, and tool structures.
 * These guards are essential for safe type narrowing when processing Claude API responses and converting
 * between Claude and OpenAI formats, ensuring type safety throughout the conversion pipeline.
 */
import type {
  MessageStreamEvent,
  MessageStartEvent,
  ContentBlock,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  ContentBlockStopEvent,
  MessageDeltaEvent,
  MessageStopEvent,
  ImageBlockParam,
  ToolResultBlockParam,
  TextBlock,
  ToolUseBlock,
  Usage,
  MessageDeltaUsage,
  Base64ImageSource,
  URLImageSource,
  Tool as ClaudeTool,
  ToolUnion,
} from "@anthropic-ai/sdk/resources/messages";
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionContentPartRefusal,
} from "openai/resources/chat/completions";
import type { ResponseOutputMessage, ResponseOutputText } from "openai/resources/responses/responses";
import { isOpenAIChatTextPart } from "../openai/chat-guards";
import { isObject } from "../../utils/type-guards";

// Claude content block guards
/**
 * Type guard to check if a block is a Claude TextBlock.
 * @param block - The content block to check
 * @returns True if the block is a text block with a string text property
 */
export function isClaudeTextBlock(block: ContentBlock | unknown): block is TextBlock {
  if (typeof block !== "object" || block === null) {
    return false;
  }
  const obj = block as { type?: unknown; text?: unknown };
  return obj.type === "text" && typeof obj.text === "string";
}

/**
 * Type guard to check if a block is a Claude ToolUseBlock.
 * @param block - The content block to check
 * @returns True if the block is a tool use block with required properties
 */
export function isClaudeToolUseBlock(block: ContentBlock | unknown): block is ToolUseBlock {
  if (typeof block !== "object" || block === null) {
    return false;
  }
  const obj = block as { type?: unknown; id?: unknown; name?: unknown };
  return obj.type === "tool_use" && typeof obj.id === "string" && typeof obj.name === "string";
}

// Stream event guards
/**
 * Identifies events that signal the start of content block generation within Claude responses.
 * Essential for tracking when Claude begins generating specific content types (text, tool calls)
 * within a message. Enables proper content parsing and organization in streaming responses.
 *
 * @param event - Streaming event from Claude's message API
 * @returns True if event indicates content block generation has started
 */
export function isClaudeContentStart(event: MessageStreamEvent): event is ContentBlockStartEvent {
  return event.type === "content_block_start";
}

/**
 * Detects incremental content updates within Claude's streaming response blocks.
 * Crucial for capturing real-time content generation as Claude produces text or tool
 * parameters. Enables progressive content assembly and live response display.
 *
 * @param event - Streaming event from Claude's message API
 * @returns True if event contains incremental content updates
 */
export function isClaudeContentDelta(event: MessageStreamEvent): event is ContentBlockDeltaEvent {
  return event.type === "content_block_delta";
}

/**
 * Identifies when Claude completes generation of a specific content block.
 * Important for finalizing content processing and triggering completion handlers
 * for individual content segments within a larger response.
 *
 * @param event - Streaming event from Claude's message API
 * @returns True if event indicates content block generation has finished
 */
export function isClaudeContentStop(event: MessageStreamEvent): event is ContentBlockStopEvent {
  return event.type === "content_block_stop";
}

/**
 * Detects message-level metadata updates during Claude's response generation.
 * Captures changes to overall message properties like stop reasons and usage statistics.
 * Essential for understanding why and how Claude concluded its response.
 *
 * @param event - Streaming event from Claude's message API
 * @returns True if event contains message-level updates
 */
export function isClaudeMessageDelta(event: MessageStreamEvent): event is MessageDeltaEvent {
  return event.type === "message_delta";
}

/**
 * Type guard to check if a stream event is a message delta event with a stop reason.
 * @param ev - The message stream event to check
 * @returns True if the event is a message_delta with a stop_reason
 */
export function isClaudeMessageDeltaWithStop(ev: MessageStreamEvent): ev is MessageDeltaEvent {
  if (!("type" in ev) || ev.type !== "message_delta") {
    return false;
  }
  const deltaEvent = ev as { delta?: { stop_reason?: unknown } };
  return typeof deltaEvent.delta?.stop_reason !== "undefined";
}

/**
 * Identifies the final event indicating Claude has completed the entire message response.
 * Critical for triggering cleanup, finalizing response processing, and determining
 * when the streaming conversation turn is complete.
 *
 * @param event - Streaming event from Claude's message API
 * @returns True if event indicates complete message generation has finished
 */
export function isClaudeMessageStop(event: MessageStreamEvent): event is MessageStopEvent {
  return event.type === "message_stop";
}

// Content delta subtypes
/**
 * Type guard to check if a content block delta contains text delta.
 * @param ev - The delta event content to check
 * @returns True if the delta is a text_delta with text content
 */
export function isClaudeTextDelta(ev: ContentBlockDeltaEvent["delta"]): ev is { type: "text_delta"; text: string } {
  if (typeof ev !== "object" || ev === null) {
    return false;
  }
  const obj = ev as { type?: unknown; text?: unknown };
  return obj.type === "text_delta" && typeof obj.text === "string";
}

/**
 * Type guard to check if a content block delta contains input JSON delta.
 * @param ev - The delta event content to check
 * @returns True if the delta is an input_json_delta with partial_json content
 */
export function isClaudeInputJsonDelta(
  ev: ContentBlockDeltaEvent["delta"],
): ev is { type: "input_json_delta"; partial_json: string } {
  if (typeof ev !== "object" || ev === null) {
    return false;
  }
  const obj = ev as { type?: unknown; partial_json?: unknown };
  return obj.type === "input_json_delta" && typeof obj.partial_json === "string";
}

/**
 * Type guard to check if a value is a ResponseOutputMessage item.
 * @param v - The value to check
 * @returns True if the value is a message type with content array
 */
export function isResponseOutputMessageItem(v: unknown): v is ResponseOutputMessage {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const obj = v as { type?: unknown; content?: unknown };
  if (obj.type !== "message") {
    return false;
  }
  return Array.isArray(obj.content);
}

// Chat content helpers
/**
 * Type guard to check if a content part is a text part.
 * @param part - The content part to check
 * @returns True if the part is a text type with text content
 */
export function isClaudeTextPart(
  part: ChatCompletionContentPart | ChatCompletionContentPartRefusal,
): part is ChatCompletionContentPartText {
  if (typeof part !== "object" || part === null) {
    return false;
  }
  const obj = part as { type?: unknown; text?: unknown };
  return obj.type === "text" && typeof obj.text === "string";
}

/**
 * Type guard to check if a content part is a refusal part.
 * @param part - The content part to check
 * @returns True if the part is a refusal type with refusal content
 */
export function isClaudeRefusalPart(
  part: ChatCompletionContentPart | ChatCompletionContentPartRefusal,
): part is ChatCompletionContentPartRefusal {
  if (typeof part !== "object" || part === null) {
    return false;
  }
  const obj = part as { type?: unknown; refusal?: unknown };
  return obj.type === "refusal" && typeof obj.refusal === "string";
}

/**
 * Converts OpenAI chat content to plain text by extracting text from various content types.
 * @param content - The chat completion message content to convert
 * @returns Plain text representation of the content
 */
export function claudeOpenAIChatContentToPlainText(content: ChatCompletionMessageParam["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    // eslint-disable-next-line no-restricted-syntax -- Text accumulation requires mutation
    let text = "";
    for (const part of content) {
      if (isOpenAIChatTextPart(part)) {
        text += part.text;
        continue;
      }

      if (isClaudeRefusalPart(part)) {
        text += part.refusal ? part.refusal : "";
      }
    }
    return text;
  }
  return "";
}

// Tool helpers
// Prefer provider-specific OpenAI guards from openai-generic

// Response output type guards
/**
 * Type guard to check if an item is a ResponseOutputText.
 * @param item - The item to check
 * @returns True if the item is an output_text type
 */
export function isResponseOutputText(item: unknown): item is ResponseOutputText {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  const obj = item as { type?: unknown };
  return obj.type === "output_text";
}

/**
 * Type guard to check if an item is a ResponseOutputMessage.
 * @param item - The item to check
 * @returns True if the item is a message type
 */
export function isResponseOutputMessage(item: unknown): item is ResponseOutputMessage {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  const obj = item as { type?: unknown };
  return obj.type === "message";
}

// Claude block type guards with proper typing
/**
 * Type guard to check if a block is a Claude ImageBlockParam.
 * @param block - The block to check
 * @returns True if the block is an image type with source property
 */
export function isClaudeImageBlockParam(block: unknown): block is ImageBlockParam {
  if (typeof block !== "object" || block === null) {
    return false;
  }
  const obj = block as { type?: unknown; source?: unknown };
  if (obj.type !== "image") {
    return false;
  }
  return "source" in obj;
}

/**
 * Type guard to check if a block is a Claude ToolResultBlockParam.
 * @param block - The block to check
 * @returns True if the block is a tool_result type with tool_use_id
 */
export function isClaudeToolResultBlockParam(block: unknown): block is ToolResultBlockParam {
  if (typeof block !== "object" || block === null) {
    return false;
  }
  const obj = block as { type?: unknown; tool_use_id?: unknown };
  if (obj.type !== "tool_result") {
    return false;
  }
  return "tool_use_id" in obj;
}

// Usage type guards
/**
 * Type guard to check if an object has Claude usage information.
 * @param obj - The object to check
 * @returns True if the object has usage with input_tokens and output_tokens
 */
export function claudeHasUsage(obj: unknown): obj is { usage: Usage } {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const withUsage = obj as { usage?: unknown };
  if (typeof withUsage.usage !== "object" || withUsage.usage === null) {
    return false;
  }
  const usage = withUsage.usage as { input_tokens?: unknown; output_tokens?: unknown };
  if (!("input_tokens" in usage)) {
    return false;
  }
  return "output_tokens" in usage;
}

/**
 * Type guard to check if an object has Claude delta usage information.
 * @param obj - The object to check
 * @returns True if the object has delta with usage property
 */
export function claudeHasDeltaUsage(obj: unknown): obj is { delta: { usage?: MessageDeltaUsage } } {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const withDelta = obj as { delta?: unknown };
  if (typeof withDelta.delta !== "object" || withDelta.delta === null) {
    return false;
  }
  return "usage" in withDelta.delta;
}

// Content array type guard
/**
 * Type guard to check if a message has a content array of ContentBlocks.
 * @param msg - The message to check
 * @returns True if the message has a content property that is an array
 */
export function claudeHasContentArray(msg: unknown): msg is { content: ContentBlock[] } {
  if (typeof msg !== "object" || msg === null) {
    return false;
  }
  const withContent = msg as { content?: unknown };
  return Array.isArray(withContent.content);
}

// Claude streaming event guards with comprehensive validation
/**
 * Validates if a streaming event marks the beginning of a Claude message response.
 * Critical for identifying when Claude starts generating a response, enabling proper
 * initialization of response tracking and metadata extraction. Used to trigger
 * response setup logic in streaming workflows.
 *
 * @param event - Streaming event from Claude's message API
 * @returns True if event indicates message generation has started
 */
export function isClaudeMessageStart(event: MessageStreamEvent): event is MessageStartEvent {
  return event.type === "message_start";
}

// Validator functions for each event type
export const eventValidators = {
  message_start: (event: MessageStartEvent) => {
    if (!event.message) {
      return false;
    }
    if (event.message.type !== "message") {
      return false;
    }
    if (typeof event.message.id !== "string") {
      return false;
    }
    if (event.message.role !== "assistant") {
      return false;
    }
    return true;
  },

  content_block_start: (event: ContentBlockStartEvent) => {
    if (typeof event.index !== "number") {
      return false;
    }
    if (!event.content_block) {
      return false;
    }
    if (!event.content_block.type) {
      return false;
    }
    if (!["text", "tool_use"].includes(event.content_block.type)) {
      return false;
    }

    // Additional validation for tool_use blocks
    if (event.content_block.type === "tool_use") {
      if (!event.content_block.id) {
        return false;
      }
      if (!event.content_block.id.startsWith("toolu_")) {
        return false;
      }
    }

    return true;
  },

  content_block_delta: (event: ContentBlockDeltaEvent) => {
    if (typeof event.index !== "number") {
      return false;
    }
    if (!event.delta) {
      return false;
    }
    if (!event.delta.type) {
      return false;
    }
    if (!["text_delta", "input_json_delta"].includes(event.delta.type)) {
      return false;
    }
    return true;
  },

  content_block_stop: (event: ContentBlockStopEvent) => {
    return typeof event.index === "number";
  },

  message_delta: (event: MessageDeltaEvent) => {
    if (!event.delta) {
      return false;
    }
    if (typeof event.delta.stop_reason !== "string") {
      return false;
    }
    return true;
  },

  message_stop: (event: MessageStopEvent) => {
    return event.type === "message_stop";
  },
} as const;

// Get all valid Claude event types
export const validClaudeEventTypes = Object.keys(eventValidators) as Array<keyof typeof eventValidators>;

/**
 * Performs comprehensive validation of Claude streaming events against expected schemas.
 * Ensures data integrity and prevents processing of malformed events that could cause
 * runtime errors. Essential for maintaining robust streaming response handling.
 *
 * @param event - Streaming event from Claude's message API requiring validation
 * @returns True if event structure and content meet Claude API specifications
 */
export function validateClaudeEvent(event: MessageStreamEvent): boolean {
  switch (event.type) {
    case "message_start":
      return eventValidators.message_start(event);
    case "content_block_start":
      return eventValidators.content_block_start(event) ? true : false;
    case "content_block_delta":
      return eventValidators.content_block_delta(event);
    case "content_block_stop":
      return eventValidators.content_block_stop(event);
    case "message_delta":
      return eventValidators.message_delta(event);
    case "message_stop":
      return eventValidators.message_stop(event);
    default:
      return false;
  }
}

// Claude image source guards
/**
 * Type guard to check if an image source is a Claude Base64ImageSource.
 * @param src - The image source to check
 * @returns True if the source is a base64 image with data and media_type
 */
export function isClaudeBase64Source(src: unknown): src is Base64ImageSource {
  return (
    typeof src === "object" &&
    src !== null &&
    (src as { type?: unknown }).type === "base64" &&
    typeof (src as { data?: unknown }).data === "string" &&
    typeof (src as { media_type?: unknown }).media_type === "string"
  );
}

/**
 * Type guard to check if an image source is a Claude URLImageSource.
 * @param src - The image source to check
 * @returns True if the source is a URL image with url property
 */
export function isClaudeURLSource(src: unknown): src is URLImageSource {
  return (
    typeof src === "object" &&
    src !== null &&
    (src as { type?: unknown }).type === "url" &&
    typeof (src as { url?: unknown }).url === "string"
  );
}

// Claude tool guards
/**
 * Type guard to check if a tool is a Claude custom tool definition (with input_schema).
 * @param t - The tool to check
 * @returns True if the tool is a Claude tool with name and input_schema properties
 */
export function isClaudeCustomTool(t: ToolUnion): t is ClaudeTool {
  if (!isObject(t)) {
    return false;
  }

  const hasName = typeof (t as { name?: unknown }).name === "string";
  if (!hasName) {
    return false;
  }

  const hasSchema = isObject((t as { input_schema?: unknown }).input_schema);
  if (!hasSchema) {
    return false;
  }

  return true;
}

// Tool conversion helpers
// Removed: use convertOpenAIChatToolToResponsesTool from openai-generic/chat-request-converter
