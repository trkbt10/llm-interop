/**
 * @file Event processing reducer for OpenAI-to-Claude streaming conversion.
 * Transforms OpenAI streaming events into Claude-compatible events while maintaining state.
 * Handles tool calls, content blocks, and completion events across different formats.
 */

import type {
  MessageStreamEvent as ClaudeStreamEvent,
  ContentBlockDeltaEvent,
  ContentBlockStartEvent,
  ContentBlockStopEvent,
  MessageDeltaEvent,
  MessageStopEvent,
} from "@anthropic-ai/sdk/resources/messages";
import type {
  ResponseStreamEvent as OpenAIResponseStreamEvent,
  ResponseCompletedEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseTextDeltaEvent,
} from "openai/resources/responses/responses";
import {
  isCodeInterpreterCallItem,
  isCodeInterpreterCodeDeltaEvent,
  isCodeInterpreterCodeDoneEvent,
  isCodeInterpreterCompletedEvent,
  isCodeInterpreterInProgressEvent,
  isCodeInterpreterInterpretingEvent,
  isFunctionCallItem,
  isImageGenerationCallItem,
  isImageGenerationCompletedEvent,
  isImageGenerationGeneratingEvent,
  isImageGenerationInProgressEvent,
  isImageGenerationPartialImageEvent,
  isWebSearchCallItem,
  isWebSearchCompletedEvent,
  isWebSearchInProgressEvent,
  isWebSearchSearchingEvent,
} from "../../providers/openai/responses-guards";
import { toClaudeToolUseIdFromOpenAI } from "../conversation/id-conversion";
import { conversionReducer } from "./state-reducer";
import type { ConversionState, ProcessEventResult } from "./types";

// Event processing reducer

/**
 * Processes individual OpenAI Response API events and converts them to Claude streaming events.
 * Manages the complex state transitions required to transform OpenAI event sequences into
 * Claude-compatible event patterns, handling content blocks, tool calls, and completion states.
 * Essential for enabling OpenAI Response API workflows to work with Claude's streaming format.
 *
 * @param state - Current conversion state tracking blocks and tool calls
 * @param event - OpenAI Response API streaming event requiring conversion
 * @returns Result containing updated state and generated Claude events
 */
export function processOpenAIEvent(state: ConversionState, event: OpenAIResponseStreamEvent): ProcessEventResult {
  const events: ClaudeStreamEvent[] = [];
  // eslint-disable-next-line no-restricted-syntax -- Required for stateful event processing across multiple switch cases
  let currentState = state;

  switch (event.type) {
    case "response.output_text.delta": {
      const textEvent = event as ResponseTextDeltaEvent;
      const delta = textEvent.delta;

      if (!delta) {
        break;
      }

      // Create text block if needed
      if (!currentState.currentTextBlockId) {
        const blockId = `text_${Date.now()}`;
        currentState = conversionReducer(currentState, { type: "ADD_TEXT_BLOCK", id: blockId });

        const block = currentState.contentBlocks.get(blockId)!;
        events.push({
          type: "content_block_start",
          index: block.index,
          content_block: { type: "text", text: "", citations: [] },
        } as ContentBlockStartEvent);

        currentState = conversionReducer(currentState, { type: "MARK_STARTED", id: blockId });
      }

      // Update text content
      currentState = conversionReducer(currentState, {
        type: "UPDATE_TEXT",
        id: currentState.currentTextBlockId!,
        delta,
      });

      const currentBlock = currentState.contentBlocks.get(currentState.currentTextBlockId!)!;
      events.push({
        type: "content_block_delta",
        index: currentBlock.index,
        delta: { type: "text_delta", text: delta },
      } as ContentBlockDeltaEvent);
      break;
    }

    case "response.output_text.done": {
      if (currentState.currentTextBlockId) {
        const block = currentState.contentBlocks.get(currentState.currentTextBlockId)!;
        events.push({
          type: "content_block_stop",
          index: block.index,
        } as ContentBlockStopEvent);

        currentState = conversionReducer(currentState, { type: "MARK_COMPLETED", id: currentState.currentTextBlockId });
        currentState = conversionReducer(currentState, { type: "SET_CURRENT_TEXT_BLOCK", id: undefined });
      }
      break;
    }

    case "response.output_item.added": {
      const addedEvent = event as ResponseOutputItemAddedEvent;
      if (isFunctionCallItem(addedEvent.item)) {
        const item = addedEvent.item;
        const claudeToolUseId = toClaudeToolUseIdFromOpenAI(item.call_id);

        currentState = conversionReducer(currentState, {
          type: "ADD_TOOL_BLOCK",
          id: item.id,
          claudeId: claudeToolUseId,
          name: item.name,
        });

        const block = currentState.contentBlocks.get(item.id)!;
        events.push({
          type: "content_block_start",
          index: block.index,
          content_block: { type: "tool_use", id: claudeToolUseId, name: item.name, input: {} },
        } as ContentBlockStartEvent);

        currentState = conversionReducer(currentState, { type: "MARK_STARTED", id: item.id });
        break;
      }
      if (isWebSearchCallItem(addedEvent.item)) {
        const item = addedEvent.item;
        const claudeToolUseId = toClaudeToolUseIdFromOpenAI(item.id);

        currentState = conversionReducer(currentState, {
          type: "ADD_TOOL_BLOCK",
          id: item.id,
          claudeId: claudeToolUseId,
          name: "web_search",
        });

        const block = currentState.contentBlocks.get(item.id)!;
        events.push({
          type: "content_block_start",
          index: block.index,
          content_block: { type: "tool_use", id: claudeToolUseId, name: "web_search", input: {} },
        } as ContentBlockStartEvent);

        currentState = conversionReducer(currentState, { type: "MARK_STARTED", id: item.id });
        break;
      }
      if (isImageGenerationCallItem(addedEvent.item)) {
        const item = addedEvent.item;
        const claudeToolUseId = toClaudeToolUseIdFromOpenAI(item.id);

        currentState = conversionReducer(currentState, {
          type: "ADD_TOOL_BLOCK",
          id: item.id,
          claudeId: claudeToolUseId,
          name: "generate_image",
        });

        const block = currentState.contentBlocks.get(item.id)!;
        events.push({
          type: "content_block_start",
          index: block.index,
          content_block: { type: "tool_use", id: claudeToolUseId, name: "generate_image", input: {} },
        } as ContentBlockStartEvent);

        currentState = conversionReducer(currentState, { type: "MARK_STARTED", id: item.id });
        break;
      }
      if (isCodeInterpreterCallItem(addedEvent.item)) {
        const item = addedEvent.item;
        const claudeToolUseId = toClaudeToolUseIdFromOpenAI(item.id);

        currentState = conversionReducer(currentState, {
          type: "ADD_TOOL_BLOCK",
          id: item.id,
          claudeId: claudeToolUseId,
          name: "str_replace_based_edit_tool",
        });

        const block = currentState.contentBlocks.get(item.id)!;
        events.push({
          type: "content_block_start",
          index: block.index,
          content_block: { type: "tool_use", id: claudeToolUseId, name: "str_replace_based_edit_tool", input: {} },
        } as ContentBlockStartEvent);

        currentState = conversionReducer(currentState, { type: "MARK_STARTED", id: item.id });
      }
      break;
    }

    case "response.function_call_arguments.delta": {
      const argsEvent = event as ResponseFunctionCallArgumentsDeltaEvent;
      const argsDelta = argsEvent.delta;
      const itemId = argsEvent.item_id;

      if (argsDelta !== null && argsDelta !== undefined && itemId !== null && itemId !== undefined) {
        const block = currentState.contentBlocks.get(itemId);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          currentState = conversionReducer(currentState, { type: "UPDATE_TOOL_ARGS", id: itemId, delta: argsDelta });

          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: argsDelta },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.output_item.done": {
      const doneEvent = event as ResponseOutputItemDoneEvent;
      if (isFunctionCallItem(doneEvent.item)) {
        const block = currentState.contentBlocks.get(doneEvent.item.id);
        if (block !== null && block !== undefined && !block.completed) {
          events.push({
            type: "content_block_stop",
            index: block.index,
          } as ContentBlockStopEvent);

          currentState = conversionReducer(currentState, { type: "MARK_COMPLETED", id: doneEvent.item.id });
        }
        break;
      }
      if (isWebSearchCallItem(doneEvent.item)) {
        const block = currentState.contentBlocks.get(doneEvent.item.id);
        if (block !== null && block !== undefined && !block.completed) {
          // Emit the query as input JSON delta
          if (doneEvent.item.action?.query) {
            const queryJson = JSON.stringify({ query: doneEvent.item.action.query });
            events.push({
              type: "content_block_delta",
              index: block.index,
              delta: { type: "input_json_delta", partial_json: queryJson },
            } as ContentBlockDeltaEvent);
          }

          events.push({
            type: "content_block_stop",
            index: block.index,
          } as ContentBlockStopEvent);

          currentState = conversionReducer(currentState, { type: "MARK_COMPLETED", id: doneEvent.item.id });
        }
        break;
      }
      if (isImageGenerationCallItem(doneEvent.item)) {
        const block = currentState.contentBlocks.get(doneEvent.item.id);
        if (block !== null && block !== undefined && !block.completed) {
          // Emit final prompt if available
          if (doneEvent.item.prompt) {
            const promptJson = JSON.stringify({ prompt: doneEvent.item.prompt });
            events.push({
              type: "content_block_delta",
              index: block.index,
              delta: { type: "input_json_delta", partial_json: promptJson },
            } as ContentBlockDeltaEvent);
          }

          events.push({
            type: "content_block_stop",
            index: block.index,
          } as ContentBlockStopEvent);

          currentState = conversionReducer(currentState, { type: "MARK_COMPLETED", id: doneEvent.item.id });
        }
        break;
      }
      if (isCodeInterpreterCallItem(doneEvent.item)) {
        const block = currentState.contentBlocks.get(doneEvent.item.id);
        if (block !== null && block !== undefined && !block.completed) {
          // Emit final code and outputs if available
          if (
            (doneEvent.item.code !== null && doneEvent.item.code !== undefined) ||
            (doneEvent.item.outputs !== null && doneEvent.item.outputs !== undefined)
          ) {
            const codeJson = JSON.stringify({
              code: doneEvent.item.code !== null && doneEvent.item.code !== undefined ? doneEvent.item.code : "",
              outputs:
                doneEvent.item.outputs !== null && doneEvent.item.outputs !== undefined ? doneEvent.item.outputs : [],
            });
            events.push({
              type: "content_block_delta",
              index: block.index,
              delta: { type: "input_json_delta", partial_json: codeJson },
            } as ContentBlockDeltaEvent);
          }

          events.push({
            type: "content_block_stop",
            index: block.index,
          } as ContentBlockStopEvent);

          currentState = conversionReducer(currentState, { type: "MARK_COMPLETED", id: doneEvent.item.id });
        }
      }
      break;
    }

    case "response.image_generation_call.generating": {
      // Image generation in progress - we can emit a delta with status
      if (isImageGenerationGeneratingEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          // Emit a delta to indicate generation is in progress
          const statusJson = JSON.stringify({ status: "generating" });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: statusJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.image_generation_call.partial_image": {
      // Partial image data - could emit as a delta
      if (isImageGenerationPartialImageEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          // Emit partial image data as delta
          const partialJson = JSON.stringify({
            partial_image: event.partial_image_b64,
            partial_index: event.partial_image_index,
          });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: partialJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.image_generation_call.completed": {
      // Image generation completed - emit completion status
      if (isImageGenerationCompletedEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          // Emit completion status
          // Note: The actual prompt and URL are typically in the output_item.done event
          const inputJson = JSON.stringify({
            status: "completed",
          });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: inputJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.completed": {
      const completedEvent = event as ResponseCompletedEvent;
      const response = completedEvent.response;

      // Update usage
      if (response?.usage) {
        currentState = conversionReducer(currentState, {
          type: "UPDATE_USAGE",
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        });
      }

      // Determine stop reason
      const hasTools = Array.from(currentState.contentBlocks.values()).some((b) => b.type === "tool_use");
      const stopReason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" = (() => {
        if (response?.status === "incomplete" && response?.incomplete_details?.reason === "max_output_tokens") {
          return "max_tokens";
        }
        if (hasTools) {
          return "tool_use";
        }
        return "end_turn";
      })();

      // Emit message delta with usage
      events.push({
        type: "message_delta",
        delta: {
          stop_reason: stopReason,
          stop_sequence: null,
        },
        usage: {
          output_tokens: currentState.usage.output_tokens,
        },
      } as MessageDeltaEvent);

      // Emit message stop
      events.push({
        type: "message_stop",
      } as MessageStopEvent);
      break;
    }

    case "response.code_interpreter_call.in_progress": {
      // Code interpreter started - emit status
      if (isCodeInterpreterInProgressEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const statusJson = JSON.stringify({ status: "in_progress" });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: statusJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.code_interpreter_call_code.delta": {
      // Code delta - append to code input
      if (isCodeInterpreterCodeDeltaEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          // Store code chunks as JSON delta
          const codeJson = JSON.stringify({ code_delta: event.delta });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: codeJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.code_interpreter_call_code.done": {
      // Code complete - emit full code
      if (isCodeInterpreterCodeDoneEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const codeJson = JSON.stringify({ code: event.code });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: codeJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.code_interpreter_call.interpreting": {
      // Code is being interpreted - emit status
      if (isCodeInterpreterInterpretingEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const statusJson = JSON.stringify({ status: "interpreting" });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: statusJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.code_interpreter_call.completed": {
      // Code interpreter completed - emit final status and outputs
      if (isCodeInterpreterCompletedEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const resultJson = JSON.stringify({
            status: "completed",
            outputs: [],
          });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: resultJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.output_text.annotation.added": {
      // Text annotation added - could be used for citations or links
      // Claude handles annotations differently, so we'll skip for now
      // The annotations will be included in the content_part.done event
      break;
    }

    case "response.image_generation_call.in_progress": {
      // Image generation started - emit status
      if (isImageGenerationInProgressEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const statusJson = JSON.stringify({ status: "in_progress" });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: statusJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.web_search_call.in_progress": {
      // Web search started - emit status
      if (isWebSearchInProgressEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const statusJson = JSON.stringify({ status: "in_progress" });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: statusJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.web_search_call.searching": {
      // Web search is searching - emit status
      if (isWebSearchSearchingEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const statusJson = JSON.stringify({
            status: "searching",
          });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: statusJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.web_search_call.completed": {
      // Web search completed - emit status
      if (isWebSearchCompletedEvent(event)) {
        const block = currentState.contentBlocks.get(event.item_id);
        if (block !== null && block !== undefined && block.type === "tool_use" && !block.completed) {
          const resultJson = JSON.stringify({
            status: "completed",
          });
          events.push({
            type: "content_block_delta",
            index: block.index,
            delta: { type: "input_json_delta", partial_json: resultJson },
          } as ContentBlockDeltaEvent);
        }
      }
      break;
    }

    case "response.created": {
      // Response created event - Claude emits message_start for similar purposes
      // This is typically the first event in a stream
      // We'll emit a message_start event to indicate streaming has begun
      events.push({
        type: "message_start",
        message: {
          id: `msg_${Date.now()}`,
          type: "message",
          role: "assistant",
          content: [],
          model: "claude-3-opus-20240229", // Default model, will be overridden by actual
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
            cache_creation: {
              ephemeral_5m_input_tokens: 0,
              ephemeral_1h_input_tokens: 0,
            },
            server_tool_use: null,
            service_tier: null,
          },
        },
      });
      break;
    }

    case "response.in_progress": {
      // Response in progress event - indicates the response is being generated
      // This can be used to emit a ping or heartbeat event to maintain connection
      // Claude doesn't have a direct equivalent, but we can use this for state tracking
      // For now, we'll just log it but preserve state
      console.debug(`[OpenAI->Claude] Response in progress`, { timestamp: Date.now() });
      break;
    }

    case "response.content_part.added":
    case "response.content_part.done":
      // Skip content_part events - these are sub-parts of message output items
      // The actual text content is already handled by response.output_text.delta events
      // Claude doesn't have a direct equivalent to OpenAI's content_part structure
      break;

    default:
      // Unknown event types are ignored, but state is preserved
      console.warn(`[OpenAI->Claude] Unknown event type: ${event.type}`, {});
      break;
  }

  return { state: currentState, events };
}
