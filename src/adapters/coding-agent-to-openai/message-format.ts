/**
 * @file Message formatting and content extraction helpers for coding-agent adapter
 */
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Extract plain text from OpenAI chat content variants.
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
      continue;
    }
    if (p.type === "text" && typeof p.text === "string") {
      out.push(p.text);
    } else {
      out.push("");
    }
  }
  return out.join("");
}

/**
 * Convert OpenAI chat messages to a simplified (role, content) list for CLI input.
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
      // Skip non-chat roles like tool
      continue;
    }
    const content = extractTextFromContent((m as { content?: string | ChatCompletionContentPart[] | null }).content);
    out.push({ role, content });
  }
  return out;
}

/**
 * Format messages as a simple markdown-ish transcript expected by CLI.
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
