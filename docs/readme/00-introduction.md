# llm-interop — Introduction

llm-interop is a lightweight toolkit that helps you interoperate between popular LLM provider shapes while keeping your app code simple. It focuses on two things:

- Emulating HTTP endpoints as a fetch-compatible function so SDKs can be driven locally without a real server.
- Converting between provider formats (OpenAI, Claude, Gemini) so you can reuse the same higher-level logic.

What you get
- Drop-in fetch emulators for OpenAI, Anthropic Claude, and Google Gemini.
- Streaming support via Server-Sent Events (SSE), with shape conversion when needed.
- Small, composable adapters you can mix and match.

Quick links
- OpenAI: docs/readme/10-fetch-emulator-openai.md
- Anthropic: docs/readme/10-fetch-emulator-anthropic.md
- Gemini: docs/readme/10-fetch-emulator-gemini.md

Notes
- All examples work in Node and compatible runtimes with fetch available.
- Set provider credentials via environment variables in your own code or test harness.
