# Coding‑Agent Backend

This adapter lets you run a local coding agent (e.g., Claude Code, Codex CLI, Gemini CLI) behind the unified OpenAI‑compatible surface. It translates the agent's stdout into markdown deltas and exposes both Chat Completions and Responses APIs (sync/stream).

## Capabilities Matrix

| API | sync | stream |
| --- | --- | --- |
| Responses API | Yes (emulated over Chat) | Yes (emulated) |
| Chat Completions | Yes | Yes |
| Models list | Stub (single configured id) | – |

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
