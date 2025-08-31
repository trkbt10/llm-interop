/**
 * @file Full combination tests (Responses/Chat × stream/sync × tools on/off)
 *
 * Uses JSONL fixtures under __mocks__/raw/openai when available, and synthetic
 * fallbacks for Chat+tools where fixtures are not present.
 */
import { join } from "node:path";
import { readJsonlToArray, readJsonl } from "../../../utils/jsonl/reader";
import type {
  Response as OpenAIResponse,
  ResponseStreamEvent,
  ResponseFunctionToolCallItem,
} from "openai/resources/responses/responses";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import { convertChatCompletionToResponse } from "./responses-adapter/chat-to-response-converter";
import { createStreamHandlerState, handleStream } from "./responses-adapter/stream-handler";
import { buildResponseItemsFromStream } from "./responses-adapter/stream-to-response-builder";

const FIX = (...p: string[]) => join(process.cwd(), "__mocks__", "raw", "openai", ...p);

describe("Responses API - sync", () => {
  it("converts a complete response (non-stream)", async () => {
    const [resp] = await readJsonlToArray<OpenAIResponse>(FIX("responses-sync.jsonl"));
    expect(resp.object).toBe("response");
    expect(typeof resp.output_text).toBe("string");
    expect(resp.usage?.total_tokens).toBe(
      (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0),
    );
  });
});

describe("Responses API - stream", () => {
  it("builds items from simple text stream", async () => {
    const events = await readJsonlToArray<ResponseStreamEvent>(FIX("responses-stream-simple.jsonl"));
    async function* gen() {
      for (const e of events) {
        yield e;
      }
    }
    const items = await buildResponseItemsFromStream(gen());
    const texts: string[] = [];
    for (const it of items) {
      if (it.type === "message") {
        for (const c of it.content) {
          if ((c as { type?: string }).type === "output_text") {
            texts.push((c as { text: string }).text);
          }
        }
      }
    }
    const text = texts.join("");
    expect(text.length).toBeGreaterThan(0);
  });

  it("captures function_call items (tools)", async () => {
    const events = await readJsonlToArray<ResponseStreamEvent>(FIX("responses-stream-tools.jsonl"));
    async function* gen() {
      for (const e of events) {
        yield e;
      }
    }
    const items = await buildResponseItemsFromStream(gen());
    const toolItems = items.filter((it): it is ResponseFunctionToolCallItem => it.type === "function_call");
    expect(toolItems.length).toBeGreaterThan(0);
    // Check at least that names/arguments are present
    const names = toolItems.map((t) => t.name).filter(Boolean);
    expect(names.length).toBeGreaterThan(0);
  });
});

describe("Chat Completions API - sync", () => {
  it("converts ChatCompletion to Response (text)", async () => {
    const [chat] = await readJsonlToArray<ChatCompletion>(FIX("chat-sync.jsonl"));
    const resp = convertChatCompletionToResponse(chat);
    expect(resp.object).toBe("response");
    expect(typeof resp.output_text).toBe("string");
    // finish_reason→status mapping
    const finish = chat.choices?.[0]?.finish_reason;
    expect(resp.status).toBe(finish === "length" ? "incomplete" : "completed");
  });

  it("converts ChatCompletion with tools to Response", async () => {
    // Synthetic ChatCompletion with tool_calls
    const toolCall: ChatCompletionMessageToolCall = {
      id: "call_1",
      type: "function",
      function: { name: "do_something", arguments: "{\"x\":1}" },
    };
    const msg: ChatCompletionMessage = {
      role: "assistant",
      content: null,
      tool_calls: [toolCall],
      refusal: null,
    } as ChatCompletionMessage; // OpenAI SDK marks some fields optional
    const chat: ChatCompletion = {
      id: "chatcmpl_1",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-test",
      choices: [{ index: 0, message: msg, logprobs: null, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as ChatCompletion;
    const resp = convertChatCompletionToResponse(chat);
    // Expect function_call item present
    const toolItems = (resp.output ?? []).filter((it) => it.type === "function_call");
    expect(toolItems.length).toBe(1);
  });
});

describe("Chat Completions API - stream", () => {
  it("converts chunks to responses events (text)", async () => {
    async function* chunks() {
      for await (const c of readJsonl<ChatCompletionChunk>(FIX("chat-stream.jsonl"))) {
        yield c;
      }
    }
    const state = createStreamHandlerState();
    const events: ResponseStreamEvent[] = [];
    for await (const ev of handleStream(state, chunks())) {
      events.push(ev);
    }
    expect(events.some((e) => e.type === "response.created")).toBe(true);
    expect(events.some((e) => e.type === "response.completed")).toBe(true);
  });

  it("emits function_call sequences when tool_calls appear", async () => {
    // Synthetic stream with tool_calls deltas
    const created = Math.floor(Date.now() / 1000);
    const base = { id: "chatcmpl_s", object: "chat.completion.chunk", created, model: "gpt-test" } as const;
    const chunkStart: ChatCompletionChunk = {
      ...base,
      choices: [{ index: 0, delta: { role: "assistant", content: "", refusal: null }, finish_reason: null }],
      // system_fingerprint omitted for type compatibility,
      service_tier: "default",
    } as ChatCompletionChunk;
    const chunkTool: ChatCompletionChunk = {
      ...base,
      choices: [{
        index: 0,
        delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "calc", arguments: "1+2" } }] },
        finish_reason: null,
      }],
      // system_fingerprint omitted for type compatibility,
      service_tier: "default",
    } as ChatCompletionChunk;
    async function* chunks() { yield chunkStart; yield chunkTool; }
    const state = createStreamHandlerState();
    const events: ResponseStreamEvent[] = [];
    for await (const ev of handleStream(state, chunks())) { events.push(ev); }
    // Should include function_call added event
    expect(events.some((e) => e.type === "response.output_item.added")).toBe(true);
  });
});
