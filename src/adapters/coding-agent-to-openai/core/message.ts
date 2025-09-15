/**
 * @file Message shaping helpers for Claude Code compatibility
 * These helpers coerce OpenAI-style message/content into the simplified
 * text-only format Claude Code expects and format a transcript with headers.
 */
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";

/**
 * Extract plain text from an OpenAI Chat content value.
 * - If a string is given, returns it as-is.
 * - If an array of content parts is given, concatenates only parts of type "text" (non-text is ignored).
 * - For any other shape, returns an empty string.
 */
export function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!content || !Array.isArray(content)) {
    return "";
  }
  const parts = content as Array<{ type?: string; text?: unknown }>;
  const out: string[] = [];
  for (const p of parts) {
    if (!p) {
      out.push("");
      continue;
    }
    if (p.type === "text" && typeof p.text === "string") {
      out.push(p.text);
      continue;
    }
    out.push("");
  }
  return out.join("");
}

/**
 * Convert OpenAI chat messages to a Claude Code-friendly structure.
 * Only system/user/assistant roles are preserved; other roles are skipped.
 * Content is coerced to text using extractTextFromContent (tool/function parts are ignored).
 */
export function toClaudeCodeMessages(
  messages: ChatCompletionMessageParam[],
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const out: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    if (!m || !("role" in m)) {
      continue;
    }
    const role = m.role;
    if (role !== "system" && role !== "user" && role !== "assistant") {
      continue;
    }
    const content = extractTextFromContent((m as { content?: string | ChatCompletionContentPart[] | null }).content);
    out.push({ role, content });
  }
  return out;
}

/**
 * Render messages into a Claude Code transcript.
 * Each message is prefixed with a markdown heading (### System/User/Assistant),
 * and a final trailing "### Assistant" header is appended to cue the next reply.
 */
export function formatMessagesForClaudeCode(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (!m || typeof m.content !== "string") {
      continue;
    }
    const role = m.role === "system" ? "System" : m.role === "user" ? "User" : "Assistant";
    lines.push(`### ${role}`);
    lines.push(m.content);
    lines.push("");
  }
  lines.push("### Assistant");
  return lines.join("\n");
}
