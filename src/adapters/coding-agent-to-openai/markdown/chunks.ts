import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { createStreamingMarkdownParser } from "../../../utils/markdown/streaming-parser";
import type { MarkdownParseEvent, BeginEvent } from "../../../utils/markdown/types";

export async function* textToChatChunks(
  model: string,
  text: string,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  const id = `chatcmpl_${Math.random().toString(36).slice(2)}`;
  const created = Math.floor(Date.now() / 1000);
  type ChoiceDelta = NonNullable<ChatCompletionChunk["choices"]>[number]["delta"];
  type Finish = NonNullable<ChatCompletionChunk["choices"]>[number]["finish_reason"];

  const mk = (delta: ChoiceDelta, finish: Finish = null): ChatCompletionChunk => ({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  });

  yield mk({ role: "assistant", content: "" });

  const parser = createStreamingMarkdownParser({});
  const openCodes = new Set<string>();
  for await (const ev of processMarkdown(parser, text)) {
    const s = renderEvent(ev, openCodes);
    if (s) {
      yield mk({ content: s });
    }
  }
  yield mk({}, "stop");
}

async function* processMarkdown(
  parser: ReturnType<typeof createStreamingMarkdownParser>,
  text: string,
): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  yield* parser.processChunk(text);
  yield* parser.complete();
}

function renderEvent(ev: MarkdownParseEvent, openCodes: Set<string>): string {
  if (ev.type === "delta") {
    return ev.content;
  }
  if (ev.type === "begin") {
    const b = ev as BeginEvent;
    if (b.elementType === "code") {
      openCodes.add(b.elementId);
      const lang = b.metadata?.language ? b.metadata.language : "";
      return `\n\u0060\u0060\u0060${lang}\n`;
    }
  }
  if (ev.type === "end") {
    if (openCodes.has(ev.elementId)) {
      openCodes.delete(ev.elementId);
      return `\n\u0060\u0060\u0060\n`;
    }
  }
  return "";
}

