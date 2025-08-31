/** @file Unit tests for generateContent */
import { generateContent } from "./generate-content";
import type { OpenAICompatibleClient, OpenAIResponse, ResponsesCreateFn } from "../openai-client-types";
import { extractFirstText } from "./core/response-mapper";
import type { ResponseCreateParams, ResponseStreamEvent } from "openai/resources/responses/responses";

describe("openai-to-gemini-v1beta generateContent", () => {
  it("maps a simple text response", async () => {
    const resp: OpenAIResponse = {
      id: "res_1",
      object: "response",
      model: "gpt-test",
      created_at: Math.floor(Date.now() / 1000),
      output_text: "hello",
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      output: [
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "hello", annotations: [], logprobs: [] }],
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
    async function createImpl(__p: ResponseCreateParams): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>> {
      void __p;
      return resp;
    }
    const create = createImpl as ResponsesCreateFn;
    const client: OpenAICompatibleClient = {
      chat: {
        completions: {
          create: async () => { throw new Error("not used"); },
        },
      },
      responses: { create },
      models: { list: async () => ({ data: [] }) },
    };

    const out = await generateContent(client, "m", { contents: [{ parts: [{ text: "hi" }] }] });
    const text = extractFirstText(out);
    expect(text).toBe("hello");
    expect(out.usageMetadata?.totalTokenCount).toBe(3);
  });
});
