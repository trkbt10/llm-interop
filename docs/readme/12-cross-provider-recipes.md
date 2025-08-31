## Cross‑provider recipes

These examples show speaking one provider’s SDK while targeting another backend via the emulator.

OpenAI SDK → Claude backend
```ts
import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "llm-interop/fetch/openai";

const fetchHandler = emulateOpenAIEndpoint({ provider: { type: "claude", apiKey: process.env.ANTHROPIC_API_KEY! } });
const openai = new OpenAI({ apiKey: "dummy", baseURL: "http://local", fetch: fetchHandler });
const res = await openai.responses.create({ model: "claude-3-5-sonnet-latest", input: "Hello" });
```

Anthropic SDK → OpenAI backend (via Claude emulator)
```ts
import Anthropic from "@anthropic-ai/sdk";
import { emulateClaudeEndpoint } from "llm-interop/fetch/claude";

// Anthropic client, but backend is OpenAI
const fetchHandler = emulateClaudeEndpoint({ provider: { type: "openai", apiKey: process.env.OPENAI_API_KEY! } });
const anthropic = new Anthropic({ apiKey: "dummy", baseURL: "http://local", fetch: fetchHandler });
const resp = await anthropic.messages.create({ model: "claude-3-5-sonnet-latest", messages: [{ role: "user", content: "Hello" }] });
```

Google Generative AI SDK → OpenAI backend (selective proxy)
```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { emulateGeminiEndpoint } from "llm-interop/fetch/gemini";

// Google client, but backend is OpenAI
const handler = emulateGeminiEndpoint({ provider: { type: "openai", apiKey: process.env.OPENAI_API_KEY! } });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : String(input);
  return /generativelanguage\.googleapis\.com\/(v1|v1beta)\//.test(url) ? handler(input, init) : originalFetch(input as any, init);
};
// ... use GoogleGenerativeAI as usual, then restore globalThis.fetch
```

Notes
- Claude emulator exposes Claude‑shaped endpoints (`/v1/messages`) while internally calling the selected backend through an OpenAI‑compatible surface.
- Gemini SDK is tightly coupled to Google endpoints; for broader interop prefer the unified OpenAI surface.

