# Fetch Emulator: OpenAI client interception

## Goal

- Swap the `fetch` that the `openai` SDK uses internally with a local emulator.
- Keep using the normal `OpenAI` SDK while requests/responses are handled locally.

## Usage

```ts
import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "llm-interop/fetch/openai";

const provider = { type: "openai", apiKey: process.env.OPENAI_API_KEY } as const;
const fetchHandler = emulateOpenAIEndpoint({ provider });

const openai = new OpenAI({
  apiKey: "dummy",          // requests are handled by the emulator
  baseURL: "http://local",  // arbitrary; only the path is routed
  fetch: fetchHandler,       // injection point
});

// Responses API (non-stream)
const obj = await openai.responses.create({
  model: "gpt-4o-mini",
  input: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
});

// Responses API (stream)
const stream = (await openai.responses.create({
  model: "gpt-4o-mini",
  input: "Hi",
  stream: true,
})) as AsyncIterable<unknown>;
for await (const e of stream) {
  // handle SSE events
}

// Chat Completions (compat)
const chat = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

## Notes

- The OpenAI SDK accepts a `fetch` option, so no need to override global fetch in most cases.
- Model listing is supported via `GET /v1/models`. Configure `provider.model` or mapping as needed.
