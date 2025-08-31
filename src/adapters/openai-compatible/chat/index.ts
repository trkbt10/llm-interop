/**
 * @file Chat Completions API module exports
 *
 * Why: Provides organized exports for chat-related functionality,
 * maintaining clear boundaries between different API concerns.
 */

export {
  extractTextFromContent,
  mapChatToolsToResponses,
  mapChatToolChoiceToResponses,
  buildResponseInputFromChatMessages,
} from "../responses-emulator/params/converter";

// Re-export from shared location
export { convertOpenAIChatToolToResponsesTool } from "../../shared/openai-tool-converters";

export {
  isOpenAIChatTextPart,
  isOpenAIChatFunctionTool,
  isOpenAIChatFunctionToolChoice,
  isOpenAIChatBasicRole,
} from "../../../providers/openai/chat-guards";
