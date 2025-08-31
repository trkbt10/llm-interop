/**
 * @file Harmony mocks → Responses streaming conversion (offline) test.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatCompletion, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
// Use global describe/it/expect from test runner; do not import vitest.
import { createHarmonyToResponsesStream } from "./to-responses-response";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

const RAW_FILE = join(process.cwd(), "__mocks__/raw/harmony/chat-sync.jsonl");

function parseFirstRecord(): { scenario: string; response: ChatCompletion } | null {
  if (!existsSync(RAW_FILE)) {
    return null;
  }
  const lines = readFileSync(RAW_FILE, "utf8").split("\n").filter(Boolean);
  if (lines.length === 0) {
    return null;
  }
  const obj = JSON.parse(lines[0]) as { scenario: string; response: ChatCompletion };
  return obj;
}

describe("Harmony mocks → Responses streaming conversion (offline)", () => {
  const first = parseFirstRecord();
  if (!first) {
    it.skip("no raw mocks present; skipping", () => {
      expect(true).toBe(true);
    });
    return;
  }

  it("emits response.created and response.completed, and deltas when applicable", async () => {
    const choice = first.response.choices?.[0];
    const msg = choice?.message;
    const contentStr: string = typeof msg?.content === "string" ? msg.content : String(msg?.content ?? "");
    // Build chunks
    async function* chunks() {
      const size = 64;
      for (let i = 0; i < contentStr.length; i += size) {
        yield contentStr.slice(i, i + size);
      }
    }

    const events: ResponseStreamEvent[] = [];
    for await (const ev of createHarmonyToResponsesStream(chunks(), { stream: true })) {
      events.push(ev);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("response.created");
    expect(events[events.length - 1].type).toBe("response.completed");

    const hasToolCalls = (() => {
      if (!Array.isArray(msg?.tool_calls)) {
        return false;
      }
      return (msg!.tool_calls as ChatCompletionMessageToolCall[]).some((tc) => tc.type === "function");
    })();
    const hasArgsDelta = events.some((e) => e.type === "response.function_call_arguments.delta");
    const hasArgsDone = events.some((e) => e.type === "response.function_call_arguments.done");
    const hasTextDelta = events.some((e) => e.type === "response.output_text.delta");
    const hasTextDone = events.some((e) => e.type === "response.output_text.done");

    if (hasToolCalls) {
      const argsOk = hasArgsDelta ? true : hasArgsDone ? true : false;
      expect(argsOk).toBe(true);
    }
    if (contentStr.includes("<|start|>") && contentStr.includes("<|end|>")) {
      const textOk = hasTextDelta ? true : hasTextDone ? true : false;
      expect(textOk).toBe(true);
    }
  });
});
