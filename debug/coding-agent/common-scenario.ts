/**
 * @file Common scenario runner for coding-agent adapter
 * Runs chat.completions and responses (sync/stream) and writes JSONL logs.
 */
import type { Provider } from "../../src/config/types";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { buildCodingAgentClient } from "../../src/adapters/coding-agent-to-openai";
import { createJsonlWriter } from "../../src/utils/jsonl/writer";
import { createLogDirectory } from "../fetch/support/log-utils";

export async function runCommonScenario(provider: Provider, label: string): Promise<void> {
  const client = buildCodingAgentClient(provider);
  const logDir = createLogDirectory(`coding-agent-${label}`);

  const prompt =
    'Act as a coding agent in a sandbox. Do NOT edit files. Output a short markdown checklist (3 items) describing how you would add a new file `src/demo.ts` that exports a function `greet()` returning `"hello"`. Do not include any other content.';

  console.log(`[coding-agent] label=${label} model=${provider.model}`);
  console.log(`[coding-agent] driver`, provider.codingAgent);
  console.log(">>> Prompt:");
  console.log(prompt);

  // Chat: non-stream
  console.log("=== Chat: Non-stream ===");
  const chatSync = await client.chat.completions.create({
    model: provider.model ? provider.model : "",
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });
  const w1 = createJsonlWriter(`${logDir}/chat-sync.jsonl`);
  await w1.write(chatSync);
  await w1.close();
  console.log(`✓ Logged ${logDir}/chat-sync.jsonl`);
  {
    const out = chatSync.choices?.[0]?.message?.content;
    if (typeof out === "string") {
      console.log("Chat (sync) output:");
      console.log(out);
    }
  }

  // Chat: stream
  console.log("=== Chat: Stream ===");
  const chatStream = (await client.chat.completions.create({
    model: provider.model ? provider.model : "",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  })) as AsyncIterable<ChatCompletionChunk>;
  const w2 = createJsonlWriter(`${logDir}/chat-stream.jsonl`);
  process.stdout.write("Chat (stream) output:\n");
  for await (const c of chatStream) {
    await w2.write(c);
    const d = c.choices?.[0]?.delta;
    if (d && typeof d.content === "string") {
      process.stdout.write(d.content);
    }
  }
  await w2.close();
  console.log(`✓ Logged ${logDir}/chat-stream.jsonl`);
  process.stdout.write("\n");

  // Responses: non-stream
  console.log("=== Responses: Non-stream ===");
  const respSync = await client.responses.create({
    model: provider.model ? provider.model : "",
    input: prompt,
    stream: false,
  });
  const w3 = createJsonlWriter(`${logDir}/responses-sync.jsonl`);
  await w3.write(respSync);
  await w3.close();
  console.log(`✓ Logged ${logDir}/responses-sync.jsonl`);
  console.log("Responses (sync) output:");
  console.log(respSync.output_text);

  // Responses: stream
  console.log("=== Responses: Stream ===");
  const respStream = (await client.responses.create({
    model: provider.model ? provider.model : "",
    input: prompt,
    stream: true,
  })) as AsyncIterable<ResponseStreamEvent>;
  const w4 = createJsonlWriter(`${logDir}/responses-stream.jsonl`);
  process.stdout.write("Responses (stream) output:\n");
  for await (const ev of respStream) {
    await w4.write(ev);
    if (ev.type === "response.output_text.delta") {
      const delta = (ev as Extract<ResponseStreamEvent, { type: "response.output_text.delta" }>).delta;
      process.stdout.write(delta);
    }
    if (ev.type === "response.completed") {
      process.stdout.write("\n");
    }
  }
  await w4.close();
  console.log(`✓ Logged ${logDir}/responses-stream.jsonl`);
}
