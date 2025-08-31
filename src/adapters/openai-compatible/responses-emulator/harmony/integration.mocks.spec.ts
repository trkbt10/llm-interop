/**
 * @file Harmony mocks → Responses conversion (offline) integration test.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatCompletion, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import type { HarmonyMessage } from "./to-responses-response";
import { convertHarmonyToResponses } from "./to-responses-response";
import { isFunctionToolCall } from "../../../../providers/openai/responses-guards";
import type { ChatCompletionMessageToolCall as ToolCall } from "openai/resources/chat/completions";

// Local helper to ensure the presence of the function body after the shared guard
type FunctionToolCallWithBody = ToolCall & { type: "function"; function: { name: string; arguments: string } };
function hasFunctionBody(tc: ToolCall & { type: "function" }): tc is FunctionToolCallWithBody {
  const obj = tc as unknown as { function?: unknown };
  if (!("function" in obj)) {
    return false;
  }
  if (typeof obj.function !== "object" || obj.function === null) {
    return false;
  }
  const fn = obj.function as { name?: unknown; arguments?: unknown };
  return typeof fn.name === "string" && typeof fn.arguments === "string";
}

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

describe("Harmony mocks → Responses conversion (offline)", () => {
  const first = parseFirstRecord();
  if (!first) {
    it.skip("no raw mocks present; skipping", () => {
      expect(true).toBe(true);
    });
    return;
  }

  it("parses Harmony-ish output and produces response.completed", async () => {
    const choice = first.response.choices?.[0];
    const msg = choice?.message;
    const contentStr: string = typeof msg?.content === "string" ? msg.content : String(msg?.content ?? "");
    const toolCalls = (Array.isArray(msg?.tool_calls) ? msg.tool_calls : []) as ChatCompletionMessageToolCall[];

    const tool_calls_harmony: HarmonyMessage["tool_calls"] | undefined = (() => {
      if (toolCalls.length === 0) {
        return undefined;
      }
      const fnCalls = toolCalls
        .filter((tc) => isFunctionToolCall(tc))
        .filter((tc): tc is FunctionToolCallWithBody => hasFunctionBody(tc))
        .map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }));
      return fnCalls.length > 0 ? fnCalls : undefined;
    })();

    const harmonyResponse: HarmonyMessage = {
      role: "assistant",
      content: contentStr,
      tool_calls: tool_calls_harmony,
    };

    const events = await convertHarmonyToResponses(harmonyResponse, {
      requestId: `spec_${Date.now()}`,
      model: first.response.model,
      stream: false,
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe("response.completed");
  });
});

// end helpers
