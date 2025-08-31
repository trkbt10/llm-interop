/**
 * @file Central export point for OpenAI Responses API type guards
 *
 * Why: Provides a single import location for all type guards related
 * to the OpenAI Responses API, organized by functionality.
 */

// Re-export tool-related guards
export {
  isOpenAIResponsesFunctionTool,
  isFunctionCallItem,
  isFunctionToolCall,
  isFunctionToolCallOutput,
  isToolChoiceFunction,
  isToolChoiceOptions,
  isWebSearchCallItem,
  isImageGenerationCallItem,
  isCodeInterpreterCallItem,
  hasToolCalls,
} from "./tools";

// Re-export stream event guards
export {
  isResponseEventStream,
  isResponseStreamEvent,
  ensureOpenAIResponseStream,
  isStreamChunk,
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
  isOutputTextDeltaEvent,
  isOutputItemAddedEvent,
  isOutputItemDoneEvent,
  isFunctionCallArgumentsDeltaEvent,
} from "./stream-event";

// Re-export create params guards
export {
  isResponseParamsStreaming,
  isResponseParamsNonStreaming,
} from "./create-params";

// Re-export output item guards
export {
  isOpenAIResponse,
  responseHasFunctionCall,
  isResponseFunctionToolCall,
  isResponseOutputMessage,
  isResponseOutputText,
  isMessageOutput,
  isFunctionCallOutput,
  hasContent,
  isResponseItemCompatible,
} from "./output-item";

// Re-export input guards
export {
  isEasyInputMessage,
  isInputText,
  isInputImage,
} from "./input";

// Re-export ResponseItem guards
export {
  isResponseInputMessageItem,
  isResponseOutputMessageItem,
  isResponseFileSearchToolCall,
  isResponseComputerToolCall,
  isResponseComputerToolCallOutputItem,
  isResponseFunctionWebSearch,
  isResponseFunctionToolCallItem,
  isResponseFunctionToolCallOutputItem,
  isResponseImageGenerationCall,
  isResponseCodeInterpreterToolCall,
  isResponseLocalShellCall,
  isResponseLocalShellCallOutput,
  isResponseMcpListTools,
  isResponseMcpApprovalRequest,
  isResponseMcpApprovalResponse,
  isResponseMcpCall,
} from "./response-item";

// Re-export ResponseInputItem guards
export {
  isResponseEasyInputMessage,
  isResponseInputMessage,
  isResponseInputOutputMessage,
  isResponseInputFileSearchToolCall,
  isResponseInputComputerToolCall,
  isResponseInputComputerCallOutput,
  isResponseInputFunctionWebSearch,
  isResponseInputFunctionToolCall,
  isResponseInputFunctionCallOutput,
  isResponseInputReasoningItem,
  isResponseInputImageGenerationCall,
  isResponseInputCodeInterpreterToolCall,
  isResponseInputLocalShellCall,
  isResponseInputLocalShellCallOutput,
  isResponseInputMcpListTools,
  isResponseInputMcpApprovalRequest,
  isResponseInputMcpApprovalResponse,
  isResponseInputMcpCall,
  isResponseInputCustomToolCallOutput,
  isResponseInputCustomToolCall,
  isResponseInputItemReference,
} from "./response-input-item";
