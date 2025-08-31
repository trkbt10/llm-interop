/**
 * @file Deterministic ID conversion utilities between different provider ecosystems
 */
// Deterministic, prefix-based ID conversions between ecosystems

// Extract suffix after the first underscore or return the whole id
function suffix(id: string): string {
  const idx = id.indexOf("_");
  return idx >= 0 ? id.slice(idx + 1) : id;
}

/**
 * Converts a Claude tool use ID to an OpenAI call ID format.
 * @param claudeToolUseId - The Claude tool use ID to convert
 * @returns OpenAI-compatible call ID with 'call_' prefix
 */
export function toOpenAICallIdFromClaude(claudeToolUseId: string): string {
  return `call_${suffix(claudeToolUseId)}`;
}

/**
 * Converts an OpenAI call ID to a Claude tool use ID format.
 * @param openaiCallId - The OpenAI call ID to convert
 * @returns Claude-compatible tool use ID with 'toolu_' prefix
 */
export function toClaudeToolUseIdFromOpenAI(openaiCallId: string): string {
  return `toolu_${suffix(openaiCallId)}`;
}

/**
 * Converts a Claude tool use ID to an OpenAI function call ID format for function_call_output.
 * @param claudeToolUseId - The Claude tool use ID to convert
 * @returns OpenAI-compatible function call ID with 'fc_' prefix
 */
export function toOpenAIFunctionCallIdFromClaude(claudeToolUseId: string): string {
  return `fc_${suffix(claudeToolUseId)}`;
}

/**
 * Compares two IDs ignoring their provider-specific prefixes.
 * @param a - First ID to compare
 * @param b - Second ID to compare
 * @returns True if the IDs have the same suffix (ignoring prefixes)
 */
export function isSameIgnoringPrefix(a: string, b: string): boolean {
  return suffix(a) === suffix(b);
}

/**
 * Generates a new OpenAI-style call ID with timestamp and random components.
 * @returns A unique call ID in OpenAI format (call_timestamp_randomString)
 */
export function generateOpenAICallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generates a new OpenAI-style message ID with timestamp and random components.
 * @returns A unique message ID in OpenAI format (msg_timestamp_randomString)
 */
export function generateOpenAIMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generates a new OpenAI-style response ID with timestamp and random components.
 * @returns A unique response ID in OpenAI format (resp_timestamp_randomString)
 */
export function generateOpenAIResponseId(): string {
  return `resp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generic ID generation function with customizable prefix, using timestamp and random components.
 * This implementation matches the pattern used in the Gemini adapter for consistency.
 * @param prefix - The prefix for the generated ID (e.g., 'msg', 'fc', 'resp')
 * @returns A unique ID in format: prefix_timestamp_randomString
 */
export function generateId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}_${random}`;
}
