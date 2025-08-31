/** @file Unit tests for streamGenerateContent */
import { streamGenerateContent } from "./stream-generate-content";
import type { OpenAICompatibleClient, ResponsesCreateFn } from "../openai-client-types";
import type { ResponseStreamEvent, ResponseTextDeltaEvent, ResponseCreateParams, Response as OpenAIResponse } from "openai/resources/responses/responses";

async function* makeEvents(): AsyncIterable<ResponseStreamEvent> {
  const base = { item_id: "msg_1", output_index: 0, content_index: 0, logprobs: [], sequence_number: 1 };
  const a: ResponseTextDeltaEvent = { type: "response.output_text.delta", delta: "He", ...base };
  const b: ResponseTextDeltaEvent = { type: "response.output_text.delta", delta: "llo", ...base, sequence_number: 2 };
  yield a;
  yield b;
}

describe("openai-to-gemini-v1beta streamGenerateContent", () => {
  it("maps text delta events to v1beta chunks", async () => {
    
    async function createUnion(__p: ResponseCreateParams): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>> {
      void __p;
      return makeEvents();
    }
    const create = createUnion as ResponsesCreateFn;
    const client: OpenAICompatibleClient = {
      chat: { completions: { create: async () => { throw new Error("not used"); } } },
      responses: { create },
      models: { list: async () => ({ data: [] }) },
    };

    const stream = await streamGenerateContent(client, "m", { contents: [{ parts: [{ text: "hi" }] }] });
    const collected: string[] = [];
    for await (const chunk of stream) {
      // Narrow to text part only; this test emits only text chunks
      const cand = (chunk as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> }).candidates[0];
      const part = cand.content.parts[0];
      if (typeof part.text === "string") {
        collected.push(part.text);
      }
    }
    expect(collected.join("")).toBe("Hello");
  });
});
