# Supported Providers

Matrix by API and streaming mode, as implemented in adapters and fetch ports.

| Provider | `provider.type` | Responses API (sync) | Responses API (stream) | Chat Completions (sync) | Chat Completions (stream) | Models list |
| --- | --- | --- | --- | --- | --- | --- |
| OpenAI | `openai` | Yes (native) | Yes (native) | Yes (native) | Yes (native) | Yes |
| Anthropic Claude | `claude` | Yes (converted) | Yes (converted) | Yes (converted) | Yes (converted) | Yes |
| Google Gemini | `gemini` | Yes (converted) | Yes (converted) | Yes (converted) | Yes (converted) | Yes |
| x.ai Grok (OpenAI‑compatible) | `grok` | Yes (native if upstream exposes /v1/responses; else emulated via Chat) | Yes (native or emulated) | Yes (native) | Yes (native) | Yes |
| Groq (OpenAI‑compatible) | `groq` | Emulated via Chat (set `openaiCompat.emulateResponsesWithChat`) | Emulated via Chat | Yes (native) | Yes (native) | Yes |
| Other OpenAI‑compatible vendors | any string | Native if upstream supports /v1/responses; otherwise emulated via Chat | Native or emulated | Yes (native) | Yes (native) | Yes |

Notes
- For OpenAI‑compatible vendors that do not implement `/v1/responses`, enable `openaiCompat.emulateResponsesWithChat` and optionally `openaiCompat.autoFallbackToEmulator`.
- Streaming is SSE where applicable; Gemini can stream via SSE or JSONL and is converted to OpenAI stream events.
- The OpenAI emulator also provides a debug‑only Ollama‑style route `GET /api/tags` (not a real Ollama backend).
- Local Coding Agent support is documented separately and not part of this matrix (see "Coding‑Agent Backend").
