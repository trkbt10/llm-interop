# Harmony conversion layer (gpt‑oss family)

Some OSS models (e.g., `openai/gpt-oss-120b`) emit Harmony‑formatted output. Use the Harmony adapter to convert Harmony messages into OpenAI Responses events.

Convert a single Harmony response to Responses events
```ts
import {
  convertHarmonyToResponses,
  type HarmonyMessage,
} from "llm-interop/adapters/openai-compatible/responses-emulator/harmony";

// Suppose you captured one Harmony message (from logs or a local runner)
const harmony: HarmonyMessage = {
  role: "assistant",
  // minimal example – include reasoning/tool_calls/final messages as emitted by your runner
  messages: [
    { channel: "final", content: "Hello from Harmony" },
  ],
};

const events = await convertHarmonyToResponses(harmony, {
  stream: false,
  model: "openai/gpt-oss-120b",
  idPrefix: "oss",
});
// 'events' is an array of OpenAI Responses events (response.created, output_* events, response.completed)
```

Stream Harmony → Responses
```ts
import { createHarmonyToResponsesStream } from "llm-interop/adapters/openai-compatible/responses-emulator/harmony";

async function* harmonyChunks() {
  // yield chunks from your Harmony JSONL stream (per line or buffered string)
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
