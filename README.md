# llm-interop — Introduction

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

# Configuration Reference

This page explains the provider configuration used across the emulators and the unified OpenAI‑compatible surface.

## Provider object

```ts
type Provider = {
  // Required: identifies the backend
  type: "openai" | "claude" | "gemini" | (string & {});

  // Optional: default model hint
  model?: string;

  // Optional: aliasing and grade mapping
  modelMapping?: {
    byGrade?: Partial<{ high: string; mid: string; low: string }>; // pick a default by "grade"
    aliases?: Record<string, string>; // map friendly names to real IDs
  };

  // Required for OpenAI‑compatible third‑party endpoints
  baseURL?: string;

  // API key and headers
  apiKey?: string;
  defaultHeaders?: Record<string, string>;

  // Low‑level API behavior
  api?: {
    // Pick an API key by model prefix (longest prefix wins)
    keyByModelPrefix?: Record<string, string>;
  };

  // OpenAI‑compat meta options controlling conversion behavior
  openaiCompat?: {
    // Harmony conversion (Responses ⇄ Harmony prompt/output)
    // When true, the adapter builds Harmony prompts and parses Harmony output
    // back into OpenAI Responses objects/events.
    transformHarmony?: boolean; // default: false

    // Use Chat Completions to emulate the Responses API when upstream lacks /v1/responses
    emulateResponsesWithChat?: boolean; // default: false

    // Prefer native Responses first; if false and emulator is enabled, try emulator first
    preferResponsesAPI?: boolean; // default: true

    // If enabled, try the other path on failure (native ↔ emulator) and aggregate errors
    autoFallbackToEmulator?: boolean; // default: false
  };
};
```

## Examples

OpenAI (passthrough)
```ts
const provider = {
  type: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  openaiCompat: {
    // Turn on Harmony conversion when targeting Harmony‑speaking OSS models
    transformHarmony: true,
    // Prefer native Responses API; no emulation needed for OpenAI
    preferResponsesAPI: true,
  },
} as const;
```

OpenAI‑compatible third‑party (custom baseURL)
```ts
const provider = {
  type: "groq", // any identifier is fine
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
  openaiCompat: {
    emulateResponsesWithChat: true, // if the vendor lacks /v1/responses
    autoFallbackToEmulator: true,
  },
} as const;
```

Multiple keys by model prefix
```ts
const provider = {
  type: "openai",
  apiKey: process.env.DEFAULT_OPENAI_KEY, // used when no prefix matches
  api: {
    keyByModelPrefix: {
      "gpt-4": process.env.OPENAI_KEY_GPT4!,
      "gpt-3.5": process.env.OPENAI_KEY_GPT35!,
    },
  },
} as const;
```

Model mapping helpers
```ts
const provider = {
  type: "openai",
  modelMapping: {
    byGrade: { high: "gpt-4o", mid: "gpt-4o-mini" },
    aliases: { default: "gpt-4o", fast: "gpt-4o-mini" },
  },
} as const;
```

## How Harmony affects behavior

When `openaiCompat.transformHarmony` is `true`:
- Input: `responses.create` params are converted into Harmony‑style chat messages (system/user/tools synthesized as needed).
- Non‑stream: Harmony‑formatted assistant output is parsed back into a final OpenAI Responses object.
- Stream: chat chunks are treated as Harmony text and converted to OpenAI Responses stream events on the fly.

Use this when calling models trained on Harmony output (e.g., `openai/gpt-oss-*`) via the unified OpenAI surface.

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

## Provider specifics

OpenAI
- Endpoints: `POST /v1/responses`, `POST /v1/chat/completions`, `GET /v1/models`, `GET /api/tags`.
- Streaming is SSE.

Claude (Anthropic)
- Uses the same OpenAI-style surface; streams are converted to Claude event shape internally.
- Exposes Claude-shaped routes through the emulator (`/v1/messages`), backed by an OpenAI-compatible client.

Gemini (Google)
- Uses the same OpenAI-style surface; internally mapped to Gemini routes.
- Native routes supported by the emulator include:
  - `POST /v1(models)/{model}:generateContent`
  - `POST /v1(models)/{model}:streamGenerateContent` (SSE or JSONL)
  - `GET /v1(models|v1beta/models)` and per-model GET

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

# Coding‑Agent Backend

This adapter lets you run a local coding agent (e.g., Claude Code, Codex CLI, Gemini CLI) behind the unified OpenAI‑compatible surface. It translates the agent's stdout into markdown deltas and exposes both Chat Completions and Responses APIs (sync/stream).

## What it does

- Spawns a CLI coding agent in a fresh tmp session (no edits to your repo). All I/O happens under `tmp/coding-agent-XXXXXX`:
  - `input.txt` (prompt snapshot)
  - `output.log` (agent stdout; tailed as a stream)
  - `result.json` (optional; driver‑specific JSON)
- Streams markdown output → OpenAI chat chunks using the markdown streaming parser.
- Detects login prompts and structured errors from the CLI (throws with a helpful message).
- Supports three upstream output modes via `produces`:
  - `text`: free‑form markdown/stdout (streaming)
  - `jsonl`: 1 JSON object per line, each containing a `result` field (streaming)
  - `json`: single JSON blob with a `result` field (non‑streaming)

## Provider configuration

Add a coding‑agent provider. Only the `codingAgent` block is used by this adapter:

```ts
import type { Provider } from "llm-interop/config/types";

const provider: Provider = {
  type: "coding-agent",
  model: "gemini-2.0-flash", // optional hint used for logs; agent decides the real model
  codingAgent: {
    kind: "gemini-cli" | "codex-cli" | "claude-code",
    binPath: "gemini" | "codex" | "/path/to/claude", // CLI executable
    args: ["--debug"], // optional extra flags passed as-is
    produces: "text" | "jsonl" | "json", // upstream output shape
  },
};
```

### Quick examples

Gemini CLI (markdown stdout):

```ts
const provider = {
  type: "coding-agent",
  model: "gemini-2.0-flash",
  codingAgent: {
    kind: "gemini-cli",
    binPath: "/Users/me/.nvm/versions/node/v22/bin/gemini",
    produces: "text",
  },
} as const;
```

Codex CLI (non‑interactive exec, sandboxed, approvals off):

```ts
const provider = {
  type: "coding-agent",
  model: "codex-cli",
  codingAgent: {
    kind: "codex-cli",
    binPath: "codex",
    args: ["-m", "my-model"], // if needed by your Codex setup
    produces: "text",
  },
} as const;
```

Claude Code (single JSON output):

```ts
const provider = {
  type: "coding-agent",
  model: "claude-code",
  codingAgent: {
    kind: "claude-code",
    binPath: "/usr/local/bin/claude",
    args: ["--output-format", "json"],
    produces: "json",
  },
} as const;
```

## Building the client

Use the adapter entrypoint to build a client from the provider (no env handling here):

```ts
import { buildCodingAgentClient } from "llm-interop/adapters/coding-agent-to-openai";

const client = buildCodingAgentClient(provider);

// Chat Completions (sync)
const chat = await client.chat.completions.create({
  model: provider.model || "",
  messages: [{ role: "user", content: "List 3 steps to add a module." }],
});
console.log(chat.choices[0]?.message?.content);

// Chat Completions (stream)
const stream = await client.chat.completions.create({
  model: provider.model || "",
  messages: [{ role: "user", content: "Show a checklist in markdown." }],
  stream: true,
});
for await (const chunk of stream) process.stdout.write(chunk.choices[0]?.delta?.content || "");

// Responses API (sync)
const res = await client.responses.create({ model: provider.model || "", input: "Next steps?" });
console.log(res.output_text);

// Responses API (stream)
const rstream = await client.responses.create({ model: provider.model || "", input: "Stream it", stream: true });
for await (const ev of rstream) if (ev.type === "response.output_text.delta") process.stdout.write(ev.delta);
```

## Safety & environment

- The agent runs in a temporary session folder (cwd=`tmp/coding-agent-XXXXXX`). No edits to your repo.
- Codex uses `exec` subcommand with `-C <session> -s read-only -a never` and `--skip-git-repo-check` to avoid touching untrusted dirs.
- Login prompts (e.g., "Please login", "Sign in") and structured errors (JSON `error`) are auto‑detected and surfaced as exceptions.

## Streaming behavior

- For `produces="text"` and `"jsonl"`, stdout is tailed and parsed incrementally by the markdown streaming parser. You see deltas as soon as the agent prints them.
- For `"json"` (single blob), the driver writes `result.json` and extracts `result` to `output.log`. If your CLI supports JSONL, prefer `produces="jsonl"` for true streaming.

## Debug scripts

Under `debug/coding-agent/` there are demo runners that compose a provider and run a common scenario:

- `geminicli.ts` – for Gemini CLI
- `codex.ts` – for Codex CLI
- `claudecode.ts` – for Claude Code

They print the provider info, prompt, and stream the outputs while also writing JSONL logs for later inspection.
