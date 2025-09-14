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

