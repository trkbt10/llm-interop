# llm-interop — Introduction

llm-interop is a lightweight toolkit that helps you interoperate between popular LLM provider shapes while keeping your app code simple. It focuses on two things:

- Emulating HTTP endpoints as a fetch-compatible function so SDKs can be driven locally without a real server.
- Converting between provider formats (OpenAI, Claude, Gemini) so you can reuse the same higher-level logic.

What you get
- Drop-in fetch emulators for OpenAI, Anthropic Claude, and Google Gemini.
- Streaming support via Server-Sent Events (SSE), with shape conversion when needed.
- Small, composable adapters you can mix and match.

Quick links
- OpenAI: docs/readme/10-fetch-emulator-openai.md
- Anthropic: docs/readme/10-fetch-emulator-anthropic.md
- Gemini: docs/readme/10-fetch-emulator-gemini.md

Notes
- All examples work in Node and compatible runtimes with fetch available.
- Set provider credentials via environment variables in your own code or test harness.

# Fetch Emulator: Anthropic (Claude) client interception

## Goal

- Forward the `@anthropic-ai/sdk` Messages API calls to a local emulator.
- Prefer the SDK's `fetch` option; if not available, temporarily override `globalThis.fetch`.

## Usage (inject via fetch option)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { emulateClaudeEndpoint } from "llm-interop/fetch/claude";

const provider = { type: "claude", apiKey: process.env.ANTHROPIC_API_KEY } as const;
const fetchHandler = emulateClaudeEndpoint({ provider });

const anthropic = new Anthropic({
  apiKey: "dummy",
  baseURL: "http://local",
  fetch: fetchHandler as typeof fetch,
});

const resp = await anthropic.messages.create({
  model: "claude-3-5-sonnet-latest",
  max_tokens: 256,
  messages: [{ role: "user", content: "Hello" }],
});
```

## Usage (temporary global fetch override)

Some SDKs/runtimes may not expose a `fetch` option. In that case, override locally:

```ts
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = emulateClaudeEndpoint({ type: "claude", apiKey: process.env.ANTHROPIC_API_KEY! }) as typeof fetch;

  const anthropic = new (await import("@anthropic-ai/sdk")).default({ apiKey: "dummy" });
  const resp = await anthropic.messages.create({ model: "claude-3-5-sonnet-latest", messages: [{ role: "user", content: "Hi" }] });
} finally {
  globalThis.fetch = originalFetch;
}
```

## Notes

- Emulator supports `POST /v1/messages` (SSE), `POST /v1/messages/count_tokens` (optional), and `GET /v1/models`.
- Internally, it calls an OpenAI-compatible backend and adapts stream events to Claude format.

# Fetch Emulator: Google Gemini client interception

## Goal

- `@google/generative-ai` uses global `fetch`. Proxy only the Gemini API domain to the emulator.

## Usage (proxy global fetch selectively)

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { emulateGeminiEndpoint } from "llm-interop/fetch/gemini";

const provider = { type: "gemini", apiKey: process.env.GOOGLE_API_KEY } as const;
const handler = emulateGeminiEndpoint({ provider });

// Forward only Google Generative Language API to the emulator
const proxiedFetch: typeof fetch = async (input, init) => {
  const urlStr = typeof input === "string" ? input : (input as URL).toString();
  if (/generativelanguage\.googleapis\.com\/(v1|v1beta)\//.test(urlStr)) {
    return handler(input, init);
  }
  return globalThis.fetch(input as any, init);
};

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = proxiedFetch;

  const genAI = new GoogleGenerativeAI("dummy-key");
  const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });
  const res = await model.generateContent({ contents: [{ role: "user", parts: [{ text: "Hello" }] }] });
  console.log(res.response.text());
} finally {
  globalThis.fetch = originalFetch;
}
```

## Notes

- Streaming uses `:streamGenerateContent` and is delivered over SSE (or JSONL when requested).
- Model listing is supported via `/v1(models|v1beta/models)`.

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
