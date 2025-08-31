/**
 * @file Harmony Response Parser.
 *
 * Parses Harmony format messages and extracts structured data
 * including channels, tool calls, and reasoning
 */

// Markdown parser imports removed - not used in current implementation
import type { HarmonyMessage, ParsedHarmonyMessage, ParsedHarmonyResponse, HarmonyParserState } from "./types";

const HARMONY_START_TOKEN = "<|start|>";
const HARMONY_END_TOKEN = "<|end|>";
const HARMONY_MESSAGE_TOKEN = "<|message|>";
const HARMONY_CHANNEL_TOKEN = "<|channel|>";
const HARMONY_CONSTRAIN_TOKEN = "<|constrain|>";
const HARMONY_RETURN_TOKEN = "<|return|>";
const HARMONY_CALL_TOKEN = "<|call|>";

/**
 * Parse a complete Harmony response
 */
export const parseHarmonyResponse = async (response: HarmonyMessage): Promise<ParsedHarmonyResponse> => {
  const content = response.content ? response.content : "";
  const messages: ParsedHarmonyMessage[] = [];
  // eslint-disable-next-line no-restricted-syntax -- Accumulating reasoning content requires mutation
  let currentReasoning = "";

  // Handle pre-parsed responses (from ChatCompletion API)
  if (response.reasoning) {
    currentReasoning = response.reasoning;
  }

  // Parse Harmony format content
  if (content.includes(HARMONY_START_TOKEN)) {
    const parsed = await parseHarmonyContent(content);
    messages.push(...parsed.messages);

    // Extract reasoning from analysis channel
    const analysisMessages = parsed.messages.filter((m) => m.channel === "analysis");
    if (analysisMessages.length > 0 && !currentReasoning) {
      currentReasoning = analysisMessages.map((m) => m.content).join("\n\n");
    }

    const toolCallsNormalized = normalizeToolCalls(response.tool_calls);
    const toolCallsResult = toolCallsNormalized ? toolCallsNormalized : extractToolCalls(messages);
    return {
      messages,
      reasoning: currentReasoning ? currentReasoning : undefined,
      toolCalls: toolCallsResult && toolCallsResult.length > 0 ? toolCallsResult : undefined,
    };
  }

  if (content) {
    // Plain content - treat as final message
    messages.push({
      channel: "final",
      content: content,
    });
  }

  // Extract tool calls
  const normalized = normalizeToolCalls(response.tool_calls);
  const toolCalls = normalized ? normalized : extractToolCalls(messages);

  return {
    messages,
    reasoning: currentReasoning ? currentReasoning : undefined,
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
  };
};

/**
 * Parse Harmony formatted content
 */
const parseHarmonyContent = async (content: string): Promise<{ messages: ParsedHarmonyMessage[] }> => {
  const state: HarmonyParserState = {
    currentMessage: undefined,
    messages: [],
    inMessage: false,
    buffer: "",
    expectingContent: false,
  };

  // Split by tokens and process
  const lines = content.split("\n");
  // eslint-disable-next-line no-restricted-syntax -- Tracking parse state requires mutation
  let endTokenProcessed = false;

  for (const line of lines) {
    if (line.includes(HARMONY_START_TOKEN)) {
      state.inMessage = true;
      continue;
    }

    if (line.includes(HARMONY_END_TOKEN)) {
      // Finalize any pending message
      if (state.currentMessage && state.buffer.trim()) {
        state.currentMessage.content = state.buffer.trim();
        state.messages.push(state.currentMessage as ParsedHarmonyMessage);
      }
      endTokenProcessed = true;
      break;
    }

    if (state.inMessage) {
      if (line.includes(HARMONY_MESSAGE_TOKEN)) {
        // Save previous message if exists
        if (state.currentMessage && state.buffer.trim()) {
          state.currentMessage.content = state.buffer.trim();
          state.messages.push(state.currentMessage as ParsedHarmonyMessage);
        }

        // Start new message
        state.currentMessage = { channel: "final", content: "" };
        state.buffer = "";
        state.expectingContent = false;
        state.currentRole = extractRole(line);
        continue;
      }

      if (line.includes(HARMONY_CHANNEL_TOKEN)) {
        const channel = extractValue(line, HARMONY_CHANNEL_TOKEN);
        if (state.currentMessage && channel) {
          state.currentMessage.channel = channel as "analysis" | "commentary" | "final";
        }
        continue;
      }

      if (line.includes(HARMONY_CONSTRAIN_TOKEN)) {
        const constrainType = extractValue(line, HARMONY_CONSTRAIN_TOKEN);
        if (state.currentMessage && constrainType) {
          state.currentMessage.constrainType = constrainType;
        }
        continue;
      }

      if (line.includes(HARMONY_RETURN_TOKEN) || line.includes(HARMONY_CALL_TOKEN)) {
        const returnValue = extractValue(line, HARMONY_RETURN_TOKEN);
        const callValue = extractValue(line, HARMONY_CALL_TOKEN);
        const recipient = returnValue ? returnValue : callValue;
        if (state.currentMessage && recipient) {
          state.currentMessage.recipient = recipient;
          state.currentMessage.isToolCall = line.includes(HARMONY_CALL_TOKEN);
        }
        state.expectingContent = true;
        continue;
      }

      // Accumulate content
      if (state.expectingContent || !isHarmonyToken(line)) {
        state.buffer += (state.buffer ? "\n" : "") + line;
      }
    }
  }

  // Finalize last message if not already finalized by END token
  if (!endTokenProcessed) {
    if (state.currentMessage) {
      if (state.buffer.trim()) {
        state.currentMessage.content = state.buffer.trim();
        state.messages.push(state.currentMessage as ParsedHarmonyMessage);
      }
    }
  }

  return { messages: state.messages };
};

/**
 * Extract role from message line
 */
const extractRole = (line: string): string | undefined => {
  const match = line.match(/role="([^"]+)"/);
  return match ? match[1] : undefined;
};

/**
 * Extract value after a token
 */
const extractValue = (line: string, token: string): string | undefined => {
  const index = line.indexOf(token);
  if (index === -1) {
    return undefined;
  }

  const afterToken = line.substring(index + token.length).trim();

  // Handle quoted values
  const quotedMatch = afterToken.match(/^"([^"]+)"/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Handle unquoted values (take until next token or end)
  const unquotedMatch = afterToken.match(/^([^<\s]+)/);
  return unquotedMatch ? unquotedMatch[1] : undefined;
};

/**
 * Check if line contains Harmony token
 */
const isHarmonyToken = (line: string): boolean => {
  if (!line.includes("<|")) {
    return false;
  }
  return line.includes("|>");
};

/**
 * Process markdown content within a message
 * Note: Markdown parser not implemented in current version
 */
const processMarkdownContent = async (content: string): Promise<string> => {
  // Simple passthrough since markdown parser is not currently used
  return content;
};

/**
 * Normalize tool calls from various formats
 */
const normalizeToolCalls = (
  toolCalls?: HarmonyMessage["tool_calls"],
): Array<{ id: string; name: string; arguments: string }> | undefined => {
  if (!toolCalls || toolCalls.length === 0) {
    return undefined;
  }

  return toolCalls.map((tc) => normalizeToolCall(tc));
};

/**
 * Normalize a single tool call
 */
const normalizeToolCall = (
  tc: NonNullable<HarmonyMessage["tool_calls"]>[0],
): { id: string; name: string; arguments: string } => {
  // OpenAI format
  if ("function" in tc && tc.type === "function") {
    return {
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    };
  }

  // Already in our format - check if it has the expected properties
  const tcObj = tc as Record<string, unknown>;
  if (tcObj && typeof tcObj === "object") {
    if ("name" in tcObj && "arguments" in tcObj) {
      return {
        id: (tcObj as { id?: string }).id ? (tcObj as { id?: string }).id! : "unknown_id",
        name: (tcObj as { name: string }).name,
        arguments: (tcObj as { arguments: string }).arguments,
      };
    }
  }

  // Fallback - this should never happen with proper types
  return {
    id: tc.id,
    name: "unknown",
    arguments: "{}",
  };
};

/**
 * Extract tool calls from parsed messages
 */
const extractToolCalls = (messages: ParsedHarmonyMessage[]): Array<{ id: string; name: string; arguments: string }> => {
  const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

  for (const message of messages) {
    if (message.isToolCall) {
      if (message.recipient) {
        if (message.content) {
          // Extract function name from recipient (e.g., "functions.get_weather" -> "get_weather")
          const srcName = message.recipient;
          const functionName = srcName.includes(".") ? srcName.split(".").pop()! : srcName;

          // Generate a unique ID
          const id = `fc_${Math.random().toString(36).substring(2, 15)}`;

          toolCalls.push({
            id,
            name: functionName,
            arguments: message.content,
          });
        }
      }
    }
  }

  return toolCalls;
};

// For backward compatibility with tests
export const createHarmonyResponseParser = () => {
  return {
    parseResponse: parseHarmonyResponse,
    parseHarmonyContent,
    processMarkdownContent,
  };
};
