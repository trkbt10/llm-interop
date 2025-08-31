/**
 * @file Public entry for Gemini -> OpenAI adapters.
 */

export { buildOpenAICompatibleClientForGemini } from "./openai-compatible";

// Low-level chat completion converters (optional)
export { geminiToChatCompletion, geminiToChatCompletionStream } from "./chat-completion/openai-chat-adapter";
export { geminiToOpenAIResponse } from "./chat-completion/openai-response-adapter";
export { geminiToOpenAIStream } from "./chat-completion/openai-stream-adapter";
