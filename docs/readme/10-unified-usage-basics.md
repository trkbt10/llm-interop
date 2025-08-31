# Unified usage (one surface, many providers)

Use the OpenAI SDK once and swap providers by changing `provider.type`.

```ts
import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "llm-interop/fetch/openai";

// Pick your target: 'openai' | 'claude' | 'gemini' | (other OpenAI-compatible)
const provider = { type: "gemini", apiKey: process.env.API_KEY } as const;
const fetchHandler = emulateOpenAIEndpoint({ provider });

const client = new OpenAI({ apiKey: "dummy", baseURL: "http://local", fetch: fetchHandler });

// Responses API (non-stream)
const res = await client.responses.create({ model: "gpt-5-mini", input: "Hello" });

// Responses API (stream)
const stream = (await client.responses.create({ model: "gpt-5-mini", input: "Hi", stream: true })) as AsyncIterable<unknown>;
for await (const e of stream) {
  // handle SSE events
}

// Chat Completions (compat)
const chat = await client.chat.completions.create({ model: "gpt-5-mini", messages: [{ role: "user", content: "Hello" }] });
```

Notes
- Works in Node or any runtime with `fetch`.
- Provide a valid API key for the selected provider type.
