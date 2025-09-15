# llm-interop — Introduction

One interface, many LLM providers. Swap backends without rewriting your app.

llm-interop is a lightweight toolkit that helps you interoperate between popular LLM providers while keeping your app code simple. It focuses on two things:

- Emulating HTTP endpoints as a fetch-compatible function so SDKs can be driven locally without a real server.
- Converting between provider formats (OpenAI, Claude, Gemini) so you can reuse the same higher-level logic.

What you get
- A single, OpenAI-style surface you can point at different providers (OpenAI, Claude, Gemini) just by changing `provider.type`.
- Drop-in fetch emulators for provider-native SDKs when you need to test those directly.
- Streaming via Server-Sent Events (SSE), with on-the-fly shape conversion when needed.

 How to use
 - See the next section “Unified usage” for a concise copy‑paste example.

Unified usage (recommended)
```ts
import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "llm-interop/fetch/openai";

// Switch provider by changing type: 'openai' | 'claude' | 'gemini'
const provider = { type: "gemini", apiKey: process.env.API_KEY } as const;
const fetchHandler = emulateOpenAIEndpoint({ provider });

const client = new OpenAI({ apiKey: "dummy", baseURL: "http://local", fetch: fetchHandler });
const res = await client.responses.create({ model: "gpt-5-mini", input: "Hello" });
```

Notes
- Works in Node and any runtime with `fetch`.
- Provide real API keys for the selected `provider.type` via your environment.
