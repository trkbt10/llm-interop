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
