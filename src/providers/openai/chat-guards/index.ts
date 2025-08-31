/**
 * @file Central export point for OpenAI Chat Completion API type guards
 *
 * Why: Provides a single import location for all type guards related
 * to the OpenAI Chat Completions API, organized by functionality.
 */

// Re-export message guards
export {
  isChatCompletionRole,
  isOpenAIChatBasicRole,
  isSystemMessageParam,
  isUserMessageParam,
  isAssistantMessageParam,
  isToolMessageParam,
  isFunctionMessageParam,
  isDeveloperMessageParam,
  isChatCompletionMessage,
  hasRefusal,
  hasToolCalls,
  hasFunctionCall,
  isFunctionToolCall,
  isCustomToolCall,
  hasAudio,
  hasContent,
} from "./message";

// Re-export tool guards
export {
  isOpenAIChatFunctionTool,
  isChatCompletionCustomTool,
  isChatCompletionTool,
  isOpenAIChatFunctionToolChoice,
  isFunctionToolChoice,
  isToolChoiceString,
  isNamedToolChoice,
  isNamedToolChoiceCustom,
  isFunctionCallOption,
  isAllowedToolChoice,
  isAllowedTools,
  hasFunctionTools,
  hasCustomTools,
  filterFunctionTools,
  filterCustomTools,
} from "./tool";

// Re-export content guards
export {
  isOpenAIChatTextPart,
  isChatImagePart,
  isChatInputAudioPart,
  isChatRefusalPart,
  isChatCompletionContentPart,
  isStringContent,
  isContentPartArray,
  isChatCompletionModality,
  isChatCompletionAudio,
  isChatCompletionAudioParam,
  isChatCompletionPredictionContent,
  extractTextFromContentParts,
  hasImageContent,
  hasAudioContent,
  hasRefusalContent,
  filterTextParts,
  filterImageParts,
} from "./content";

// Re-export params guards
export {
  isChatParamsStreaming,
  isChatParamsNonStreaming,
  isChatCompletionCreateParams,
  isChatCompletionStreamOptions,
  isChatCompletionUpdateParams,
  isChatCompletionListParams,
  hasTools,
  hasFunctions,
  hasResponseFormat,
  hasAudioParams,
  hasModalities,
  hasPrediction,
  hasStore,
  hasMetadata,
  hasReasoningEffort,
} from "./params";

// Re-export stream guards
export {
  isChatCompletionChunk,
  isChatCompletionStream,
  hasFinishReason,
  isFinalChunk,
  hasDeltaContent,
  hasDeltaToolCalls,
  hasDeltaFunctionCall,
  hasDeltaRefusal,
  hasDeltaAudio,
  hasUsage,
  hasServiceTier,
  extractDeltaContent,
  getFinishReasons,
  ensureChatCompletionStream,
} from "./stream";

// Re-export completion guards
export {
  isChatCompletion,
  isChatCompletionDeleted,
  isParsedChatCompletion,
  isParsedChoice,
  isParsedMessage,
  isParsedFunctionToolCall,
  isChatCompletionTokenLogprob,
  isChatCompletionStoreMessage,
  hasCompletionUsage,
  hasSystemFingerprint,
  hasCompletionServiceTier,
  isCompleteResponse,
  hasRefusalInCompletion,
  getCompletionFinishReasons,
  extractMessages,
} from "./completion";