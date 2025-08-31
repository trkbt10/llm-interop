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

