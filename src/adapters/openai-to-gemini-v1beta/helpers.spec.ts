/** @file Unit tests for v1beta adapter helpers */

import { firstTextFromContents, systemInstructionText, buildNonStreamingParams, buildStreamingParams } from "./core/request-mapper";
import { isAsyncIterable } from "./core/guards";
import { isOpenAIResponse } from "../../providers/openai/responses-guards";
import { toGeminiResponse, extractFirstText } from "./core/response-mapper";
import type { GeminiRequest } from "./core/gemini-types";
import type { OpenAIResponse } from "../openai-client-types";

describe("openai-to-gemini-v1beta helpers", () => {
  it("extracts first user text", () => {
    const req: GeminiRequest = { contents: [{ parts: [{ text: "hello" }] }] };
    const p = firstTextFromContents(req.contents);
    expect(p).toBe("hello");
  });

  it("system instruction text is optional", () => {
    const a = systemInstructionText();
    expect(a).toBeUndefined();
    const b = systemInstructionText();
    expect(b).toBeUndefined();
  });

  it("builds non-streaming params with input & instructions", () => {
    const req: GeminiRequest = {
      contents: [{ parts: [{ text: "hello" }] }],
      generationConfig: { maxOutputTokens: 77 },
    };
    const p = buildNonStreamingParams("m", req);
    expect(p.stream).toBe(false);
    expect(p.model).toBe("m");
    expect(p.input).toBe("hello");
    expect(p.instructions).toBeUndefined();
    expect(p.max_output_tokens).toBe(77);
  });

  it("builds streaming params", () => {
    const p = buildStreamingParams("m", { contents: [{ parts: [{ text: "hi" }] }] });
    expect(p.stream).toBe(true);
    expect(p.model).toBe("m");
  });

  it("detects async iterable", async () => {
    async function* g() {
      yield 1;
    }
    const s = g();
    expect(isAsyncIterable(s)).toBe(true);
    expect(isAsyncIterable(null)).toBe(false);
    expect(isAsyncIterable({})).toBe(false);
  });

  it("guards OpenAIResponse and converts to Gemini", () => {
    const resp: OpenAIResponse = {
      id: "res_x",
      object: "response",
      model: "gpt-test",
      created_at: Math.floor(Date.now() / 1000),
      output_text: "ok",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      output: [
        {
          type: "message",
          id: "msg_x",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "ok", annotations: [], logprobs: [] }],
        },
      ],
      parallel_tool_calls: true,
      temperature: null,
      tool_choice: "auto",
      tools: [],
      top_p: null,
      usage: {
        input_tokens: 1,
        output_tokens: 2,
        total_tokens: 3,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
      status: "completed",
    };
    expect(isOpenAIResponse(resp)).toBe(true);
    const g = toGeminiResponse(resp);
    const text = extractFirstText(g);
    expect(text).toBe("ok");
    expect(g.usageMetadata?.totalTokenCount).toBe(3);
  });
});
