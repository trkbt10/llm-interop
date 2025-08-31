/**
 * @file Conversion tests using raw OpenAI JSONL fixtures
 *
 * Verifies conversions between Chat Completions and Responses API for
 * - Non-stream (chat completion -> responses)
 * - Stream (chat chunks -> response events -> rebuilt items)
 * - Stream (responses events -> rebuilt items)
 * using fixtures under `__mocks__/raw/openai` and the JSONL reader utilities.
 */

import { readJsonlToArray, readJsonl } from "../../../utils/jsonl/reader";
import { join } from "node:path";
import type { ChatCompletion, ChatCompletionChunk } from "openai/resources/chat/completions";
import type {
  ResponseStreamEvent,
  ResponseCompletedEvent,
  ResponseItem,
  ResponseOutputMessage,
  ResponseOutputText,
} from "openai/resources/responses/responses";
import { convertChatCompletionToResponse } from "./responses-adapter/chat-to-response-converter";
import { createStreamHandlerState, handleStream } from "./responses-adapter/stream-handler";
import { buildResponseItemsFromStream } from "./responses-adapter/stream-to-response-builder";

const FIXTURES_DIR = join(process.cwd(), "__mocks__", "raw", "openai");

describe("JSONL conversions: Chat <-> Responses", () => {
  it("non-stream: converts ChatCompletion to Responses", async () => {
    const file = join(FIXTURES_DIR, "chat-sync.jsonl");
    const [completion] = (await readJsonlToArray<ChatCompletion>(file)).slice(0, 1);

    const resp = convertChatCompletionToResponse(completion);

    expect(resp).toBeTruthy();
    expect(resp.id).toBe(completion.id);
    expect(resp.model).toBe(completion.model);
    // output_text should aggregate the assistant message text content
    expect(typeof resp.output_text).toBe("string");
    expect(resp.output_text.length).toBeGreaterThan(0);
    // status derived from finish_reason
    const finish = completion.choices?.[0]?.finish_reason;
    expect(resp.status).toBe(finish === "length" ? "incomplete" : "completed");
  });

  it("stream: converts ChatCompletion chunks to Responses events and rebuilds items", async () => {
    const file = join(FIXTURES_DIR, "chat-stream.jsonl");
    async function* chunkStream() {
      for await (const c of readJsonl<ChatCompletionChunk>(file)) {
        yield c;
      }
    }
    // Convert chat chunks -> responses events
    const state = createStreamHandlerState();
    const events: ResponseStreamEvent[] = [];
    for await (const ev of handleStream(state, chunkStream())) {
      events.push(ev);
    }

    // Sanity: has created and completed
    expect(events.some((e) => e.type === "response.created")).toBe(true);
    expect(events.some((e) => e.type === "response.completed")).toBe(true);

    // Rebuild items from events
    async function* asGen() {
      for (const e of events) {
      yield e;
    }
    }
    const items = await buildResponseItemsFromStream(asGen());
    // Expect at least one message item with output text
    const text = extractOutputText(items);
    expect(text.length).toBeGreaterThan(0);
  });

  it("stream: rebuilds complete text from Responses stream events", async () => {
    const file = join(FIXTURES_DIR, "responses-stream-simple.jsonl");
    const events: ResponseStreamEvent[] = await readJsonlToArray<ResponseStreamEvent>(file);
    const completed = events.find((e): e is ResponseCompletedEvent => e.type === "response.completed");
    expect(Boolean(completed)).toBe(true);
    const expectedText = completed ? completed.response.output_text : "";
    expect(typeof expectedText).toBe("string");

    async function* asGen() {
      for (const e of events) {
      yield e;
    }
    }
    const items = await buildResponseItemsFromStream(asGen());
    const text = extractOutputText(items);
    expect(text).toBe(expectedText);
  });
});


function extractOutputText(items: ResponseItem[]): string {
  const messages = items.filter((it): it is ResponseOutputMessage => (it as { type?: string }).type === "message");
  const parts = messages.flatMap((m) => m.content);
  const texts = parts.filter((p): p is ResponseOutputText => p.type === "output_text").map((p) => p.text);
  return texts.join("");
}
