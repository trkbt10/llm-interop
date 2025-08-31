/**
 * @file Re-exports of type guards moved to their respective provider directories.
 * This file serves as a backwards compatibility layer while maintaining
 * organized provider-specific guard locations.
 */

// Re-export Claude guards from their new location
export {
  isClaudeMessageStart as isMessageStartEvent,
  isClaudeContentStart as isContentBlockStartEvent,
  isClaudeContentDelta as isContentBlockDeltaEvent,
  isClaudeContentStop as isContentBlockStopEvent,
  isClaudeMessageDelta as isMessageDeltaEvent,
  isClaudeMessageStop as isMessageStopEvent,
  eventValidators,
  validClaudeEventTypes,
  validateClaudeEvent,
} from "../../providers/claude/guards";

// Re-export OpenAI guards from their new location
export {
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
} from "../../providers/openai/responses-guards";
