/**
 * @file State reducer for managing OpenAI to Claude message conversion during streaming.
 * Implements a Redux-style reducer pattern to handle the incremental construction of Claude messages
 * from OpenAI streaming events. This is necessary because OpenAI and Claude have different streaming
 * formats - OpenAI sends deltas that need to be accumulated into Claude's block-based structure.
 */
import type { ConversionState, ConversionAction } from "./types";

// State reducer

/**
 * Manages stateful conversion from OpenAI streaming events to Claude message structure.
 * Implements Redux-style state management to incrementally build Claude content blocks
 * from OpenAI delta events, handling the fundamental difference between OpenAI's delta-based
 * streaming and Claude's block-based content model. Essential for maintaining conversion
 * accuracy across complex streaming scenarios.
 *
 * @param state - Current conversion state with content blocks and tracking information
 * @param action - State update action representing OpenAI event processing results
 * @returns Updated conversion state reflecting the processed action
 */
export function conversionReducer(state: ConversionState, action: ConversionAction): ConversionState {
  switch (action.type) {
    case "ADD_TEXT_BLOCK": {
      const newState = { ...state };
      newState.contentBlocks.set(action.id, {
        index: state.currentIndex,
        type: "text",
        id: action.id,
        content: "",
        started: false,
        completed: false,
      });
      newState.currentIndex++;
      newState.currentTextBlockId = action.id;
      return newState;
    }

    case "ADD_TOOL_BLOCK": {
      const newState = { ...state };
      newState.contentBlocks.set(action.id, {
        index: state.currentIndex,
        type: "tool_use",
        id: action.claudeId,
        name: action.name,
        content: "",
        started: false,
        completed: false,
      });
      newState.currentIndex++;
      return newState;
    }

    case "UPDATE_TEXT": {
      const block = state.contentBlocks.get(action.id);
      if (block && block.type === "text") {
        block.content += action.delta;
      }
      return state;
    }

    case "UPDATE_TOOL_ARGS": {
      const block = state.contentBlocks.get(action.id);
      if (block && block.type === "tool_use") {
        block.content += action.delta;
      }
      return state;
    }

    case "MARK_STARTED": {
      const block = state.contentBlocks.get(action.id);
      if (block) {
        block.started = true;
      }
      return state;
    }

    case "MARK_COMPLETED": {
      const block = state.contentBlocks.get(action.id);
      if (block) {
        block.completed = true;
      }
      return state;
    }

    case "SET_CURRENT_TEXT_BLOCK": {
      return { ...state, currentTextBlockId: action.id };
    }

    case "UPDATE_USAGE": {
      return {
        ...state,
        usage: {
          input_tokens: action.input ?? state.usage.input_tokens,
          output_tokens: action.output ?? state.usage.output_tokens,
        },
      };
    }

    default:
      return state;
  }
}
