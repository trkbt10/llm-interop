/**
 * @file Public entry for Claude -> OpenAI adapters and converters.
 */

export { buildOpenAICompatibleClientForClaude } from "./responses-api/openai-compatible";
export { claudeToResponsesLocal } from "./responses-api/request-to-responses";
export {
  claudeToOpenAIResponse,
  claudeToOpenAIStream,
  claudeToChatCompletion,
  claudeToChatCompletionStream,
} from "./chat-completion/openai-response-adapter";
