/**
 * @file Unit tests for message-format helpers (uses vitest globals)
 */
import { extractTextFromContent, toClaudeCodeMessages, formatMessagesForClaudeCode } from "./core/message";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

describe("message-format helpers", () => {
  it("extractTextFromContent handles string", () => {
    expect(extractTextFromContent("hello")).toBe("hello");
  });
  it("extractTextFromContent handles parts[]", () => {
    const parts = [{ type: "text", text: "a" }, { type: "text", text: "b" }];
    expect(extractTextFromContent(parts)).toBe("ab");
  });
  it("toClaudeCodeMessages filters non-chat roles and normalizes content", () => {
    const msgs: ChatCompletionMessageParam[] = [
      { role: "system", content: "sys" },
      { role: "user", content: [{ type: "text", text: "hi" }] },
      { role: "assistant", content: "ok" },
      // valid tool message (should be filtered out by the adapter)
      { role: "tool", tool_call_id: "call_1", content: "ignored" },
    ];
    const out = toClaudeCodeMessages(msgs);
    expect(out).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "ok" },
    ]);
  });
  it("formatMessagesForClaudeCode renders sections and trailing Assistant header", () => {
    const prompt = formatMessagesForClaudeCode([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
    expect(prompt).toContain("### System\nS");
    expect(prompt).toContain("### User\nU");
    expect(prompt.trim().endsWith("### Assistant")).toBe(true);
  });
});
