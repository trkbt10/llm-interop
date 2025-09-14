import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";

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

export function formatMessagesForClaudeCode(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (!m || typeof m.content !== "string") {
      continue;
    }
    let role: string;
    if (m.role === "system") {
      role = "System";
    } else if (m.role === "user") {
      role = "User";
    } else {
      role = "Assistant";
    }
    lines.push(`### ${role}`);
    lines.push(m.content);
    lines.push("");
  }
  lines.push("### Assistant");
  return lines.join("\n");
}
