# Harmony conversion layer (gpt‑oss family)

Some OSS models (e.g., `openai/gpt-oss-120b`) emit Harmony‑formatted output. Enable Harmony in config to make the unified OpenAI surface transparently convert between Responses and Harmony.

## Enable via provider config

```ts
import OpenAI from "openai";
import { emulateOpenAIEndpoint } from "llm-interop/fetch/openai";

const provider = {
  type: "openai",
  apiKey: process.env.OPENAI_API_KEY!,
  openaiCompat: {
    transformHarmony: true,
  },
} as const;

const fetchHandler = emulateOpenAIEndpoint({ provider });
const client = new OpenAI({ apiKey: "dummy", baseURL: "http://local", fetch: fetchHandler });

// Non‑stream: Harmony output is parsed back into a final Responses object
const res = await client.responses.create({ model: "openai/gpt-oss-120b", input: "Hello" });

// Stream: Harmony text is converted on the fly into Responses stream events
const stream = (await client.responses.create({ model: "openai/gpt-oss-120b", input: "Hi", stream: true })) as AsyncIterable<unknown>;
for await (const ev of stream) {
  // handle OpenAI Responses stream events
}
```

Behavior when enabled
- Input: `responses.create` params are synthesized into Harmony‑style chat messages.
- Output (non‑stream): Harmony content is parsed and returned as a standard Responses object.
- Output (stream): Chat deltas are treated as Harmony text and converted to Responses events.

See also: `09-configuration.md` for the full config reference.

## Advanced: manual conversion APIs

You usually don’t need these when `transformHarmony` is enabled, but the low‑level utilities are available for custom pipelines.

Convert a single Harmony response to Responses events
```ts
import { convertHarmonyToResponses, type HarmonyMessage } from "llm-interop/adapters/openai-compatible/responses-emulator/harmony";

const harmony: HarmonyMessage = { role: "assistant", messages: [{ channel: "final", content: "Hello from Harmony" }] };
const events = await convertHarmonyToResponses(harmony, { stream: false, model: "openai/gpt-oss-120b" });
```

Stream Harmony → Responses
```ts
import { createHarmonyToResponsesStream } from "llm-interop/adapters/openai-compatible/responses-emulator/harmony";

async function* harmonyChunks() {
  yield { channel: "final", content: "Hello" };
  yield { channel: "final", content: " world" };
}

for await (const ev of createHarmonyToResponsesStream(harmonyChunks(), { stream: true, model: "openai/gpt-oss-120b" })) {
  // consume OpenAI Responses stream events
}
```

Notes
- The adapter understands Harmony tokens and emits Responses text/tool events accordingly.
- Tokenization helpers (`tokenizeHarmony`, etc.) are exported for advanced usage (o200k_harmony).
