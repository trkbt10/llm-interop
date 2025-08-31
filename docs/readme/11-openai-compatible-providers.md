# OpenAI‑compatible providers (Groq, Grok, etc.)

Many providers expose OpenAI‑compatible APIs. Point the unified surface at them by setting `provider.type` and (if needed) `baseURL`.

Groq (OpenAI‑compatible)
```ts
import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "llm-interop/fetch/openai";

const provider = {
  type: "groq",
  apiKey: process.env.GROQ_API_KEY!,
  // Groq uses OpenAI‑style API under /openai/v1
  baseURL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
} as const;

const fetchHandler = emulateOpenAIEndpoint({ provider });
const client = new OpenAI({ apiKey: "dummy", baseURL: "http://local", fetch: fetchHandler });
const res = await client.responses.create({ model: "llama3-groq-70b", input: "Hello" });
```

Grok (x.ai, OpenAI‑compatible)
```ts
import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "llm-interop/fetch/openai";

const provider = {
  type: "grok",
  apiKey: process.env.GROK_API_KEY!,
  // Base URL defaults to https://api.x.ai/v1 if omitted
  // baseURL: "https://api.x.ai/v1",
} as const;

const fetchHandler = emulateOpenAIEndpoint({ provider });
const client = new OpenAI({ apiKey: "dummy", baseURL: "http://local", fetch: fetchHandler });
const res = await client.responses.create({ model: "grok-3", input: "Hello" });
```

Notes
- You can use the same Responses/Chat endpoints as OpenAI. Streaming (SSE) is supported.
- For other OpenAI‑compatible vendors, set `provider.type` to an identifier and `baseURL` to their OpenAI‑style endpoint.
