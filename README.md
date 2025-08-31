# llm-interop

このリポジトリは、LLM 各社（OpenAI / Anthropic Claude / Google Gemini ほか）を OpenAI 互換の形で相互運用するためのアダプター群と、`fetch` ベースの簡易エミュレーター（疑似エンドポイント）を提供します。

詳しい説明と使い方は `docs/readme/` を参照してください。

- docs/readme/10-fetch-emulator.md — fetch エミュレーターの使い方
- docs/readme/10-fetch-emulator-openai.md — OpenAI クライアントへの介入方法
- docs/readme/10-fetch-emulator-anthropic.md — Anthropic クライアントへの介入方法
- docs/readme/10-fetch-emulator-gemini.md — Google Gemini クライアントへの介入方法
- docs/readme/20-adapters-openai-client.md — OpenAI 互換クライアントのファクトリー
- docs/readme/20-adapters-openai-compatible.md — OpenAI 公式/互換エンドポイント向けアダプター
- docs/readme/20-adapters-claude-to-openai.md — Claude → OpenAI 変換
- docs/readme/20-adapters-gemini-to-openai.md — Gemini → OpenAI 変換
- docs/readme/20-adapters-openai-to-claude.md — OpenAI → Claude 変換
- docs/readme/20-adapters-openai-to-gemini.md — OpenAI → Gemini 変換
- docs/readme/20-adapters-conversation.md — 会話/ツール呼び出し ID 変換ヘルパ
- docs/readme/30-providers-openai.md — OpenAI プロバイダー
- docs/readme/30-providers-claude.md — Claude プロバイダー
- docs/readme/30-providers-gemini.md — Gemini プロバイダー
