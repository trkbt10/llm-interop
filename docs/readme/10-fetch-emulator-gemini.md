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
