/**
 * @file Public entry for OpenAI provider helpers.
 */

// Chat guards (explicit exports)
export {
  isOpenAIChatTextPart,
  isOpenAIChatFunctionTool,
  isOpenAIChatFunctionToolChoice,
  isOpenAIChatBasicRole,
  isFunctionToolChoice,
} from "./chat-guards/index";

// Responses guards (explicit exports)
export {
  isResponseEventStream,
  isResponseStreamEvent,
  ensureOpenAIResponseStream,
  isOpenAIResponse,
  responseHasFunctionCall,
  isOpenAIResponsesFunctionTool,
  isImageGenerationGeneratingEvent,
  isImageGenerationPartialImageEvent,
  isImageGenerationCompletedEvent,
  isImageGenerationInProgressEvent,
  isCodeInterpreterInProgressEvent,
  isCodeInterpreterCodeDeltaEvent,
  isCodeInterpreterCodeDoneEvent,
  isCodeInterpreterInterpretingEvent,
  isCodeInterpreterCompletedEvent,
  isWebSearchInProgressEvent,
  isWebSearchSearchingEvent,
  isWebSearchCompletedEvent,
  isFunctionCallItem,
  isWebSearchCallItem,
  isImageGenerationCallItem,
  isCodeInterpreterCallItem,
  isResponseFunctionToolCall,
  isResponseOutputMessage,
  isResponseParamsStreaming,
  isResponseParamsNonStreaming,
  isMessageOutput,
  isFunctionCallOutput,
  isFunctionToolCall,
  hasContent,
  hasToolCalls,
  isStreamChunk,
  isResponseItemCompatible,
  isEasyInputMessage,
  isFunctionToolCallOutput,
  isInputText,
  isInputImage,
  isToolChoiceFunction,
  isToolChoiceOptions,
} from "./responses-guards/index";
