/**
 * @file Tests for OpenAI to Claude event processing reducer
 */

import { processOpenAIEvent } from "./event-reducer";
import type { ConversionState } from "./types";
import type {
  ResponseStreamEvent as OpenAIResponseStreamEvent,
  ResponseTextDeltaEvent,
  ResponseOutputItemAddedEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseOutputItemDoneEvent,
  ResponseCompletedEvent,
} from "openai/resources/responses/responses";

// Test helper to safely cast test objects to stream events
function createTestEvent(eventData: Record<string, unknown>): OpenAIResponseStreamEvent {
  // This is a test utility that bypasses strict typing for invalid event testing
  // eslint-disable-next-line custom/no-as-outside-guard -- Test utility for invalid event testing
  return eventData as unknown as OpenAIResponseStreamEvent;
}

describe("Event Reducer", () => {
  describe("processOpenAIEvent", () => {
    // eslint-disable-next-line no-restricted-syntax -- needed for test state management
    let initialState: ConversionState;

    beforeEach(() => {
      initialState = {
        messageId: "msg_test",
        contentBlocks: new Map(),
        currentIndex: 0,
        currentTextBlockId: undefined,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      };
    });

    describe("Text processing events", () => {
      it("should create text block on first text delta", () => {
        const event: ResponseTextDeltaEvent = {
          type: "response.output_text.delta",
          delta: "Hello",
        } as ResponseTextDeltaEvent;

        const result = processOpenAIEvent(initialState, event);

        expect(result.state.contentBlocks.size).toBe(1);
        expect(result.state.currentTextBlockId).toBeDefined();
        expect(result.events).toHaveLength(2); // content_block_start + content_block_delta

        const startEvent = result.events[0];
        expect(startEvent.type).toBe("content_block_start");
        expect((startEvent as { content_block: { type: string } }).content_block.type).toBe("text");

        const deltaEvent = result.events[1];
        expect(deltaEvent.type).toBe("content_block_delta");
        expect((deltaEvent as { delta: { type: string; text: string } }).delta.type).toBe("text_delta");
        expect((deltaEvent as { delta: { type: string; text: string } }).delta.text).toBe("Hello");
      });

      it("should append to existing text block", () => {
        // Set up state with existing text block
        const stateWithText: ConversionState = {
          ...initialState,
          currentTextBlockId: "text_123",
          contentBlocks: new Map([
            [
              "text_123",
              {
                id: "text_123",
                type: "text",
                index: 0,
                content: "Hello",
                started: true,
                completed: false,
              },
            ],
          ]),
          currentIndex: 1,
        };

        const event: ResponseTextDeltaEvent = {
          type: "response.output_text.delta",
          delta: " world",
        } as ResponseTextDeltaEvent;

        const result = processOpenAIEvent(stateWithText, event);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("content_block_delta");
        expect((result.events[0] as { delta: { text: string } }).delta.text).toBe(" world");

        const textBlock = result.state.contentBlocks.get("text_123");
        expect(textBlock?.content).toBe("Hello world");
      });

      it("should complete text block on text done event", () => {
        const stateWithText: ConversionState = {
          ...initialState,
          currentTextBlockId: "text_123",
          contentBlocks: new Map([
            [
              "text_123",
              {
                id: "text_123",
                type: "text",
                index: 0,
                content: "Complete text",
                started: true,
                completed: false,
              },
            ],
          ]),
        };

        const event = { type: "response.output_text.done" } as OpenAIResponseStreamEvent;

        const result = processOpenAIEvent(stateWithText, event);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("content_block_stop");

        const textBlock = result.state.contentBlocks.get("text_123");
        expect(textBlock?.completed).toBe(true);
        expect(result.state.currentTextBlockId).toBeUndefined();
      });

      it("should handle empty text delta", () => {
        const event: ResponseTextDeltaEvent = {
          type: "response.output_text.delta",
          delta: "",
        } as ResponseTextDeltaEvent;

        const result = processOpenAIEvent(initialState, event);

        // Empty string is falsy, so the code breaks early and creates no blocks
        expect(result.state.contentBlocks.size).toBe(0);
        expect(result.events).toHaveLength(0);
      });

      it("should handle null delta gracefully", () => {
        const event = {
          type: "response.output_text.delta",
          delta: null,
          output_index: 0,
          sequence_number: 0,
          item_id: "dummy",
        };

        const result = processOpenAIEvent(initialState, createTestEvent(event));

        // Should not create any blocks or events
        expect(result.state.contentBlocks.size).toBe(0);
        expect(result.events).toHaveLength(0);
      });
    });

    describe("Function call processing", () => {
      it("should create tool use block on function call added", () => {
        const event: ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          output_index: 0,
          sequence_number: 0,
          item: {
            type: "function_call",
            id: "func_123",
            call_id: "call_abc",
            name: "get_weather",
            arguments: "",
          },
        };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state.contentBlocks.size).toBe(1);
        expect(result.events).toHaveLength(1);

        const startEvent = result.events[0];
        expect(startEvent.type).toBe("content_block_start");
        const blockStartEvent = startEvent as { content_block: { type: string; name: string; id: string } };
        expect(blockStartEvent.content_block.type).toBe("tool_use");
        expect(blockStartEvent.content_block.name).toBe("get_weather");
        expect(blockStartEvent.content_block.id).toContain("toolu_"); // Claude ID format
      });

      it("should handle function call arguments delta", () => {
        const stateWithTool: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "func_123",
              {
                id: "toolu_abc",
                type: "tool_use",
                index: 0,
                name: "get_weather",
                content: '{"location":',
                started: true,
                completed: false,
              },
            ],
          ]),
          currentIndex: 1,
        };

        const event: ResponseFunctionCallArgumentsDeltaEvent = {
          type: "response.function_call_arguments.delta",
          output_index: 0,
          sequence_number: 0,
          delta: '"San Francisco"}',
          item_id: "func_123",
        };

        const result = processOpenAIEvent(stateWithTool, event);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("content_block_delta");
        const deltaEvent = result.events[0] as { delta: { type: string; partial_json: string } };
        expect(deltaEvent.delta.type).toBe("input_json_delta");
        expect(deltaEvent.delta.partial_json).toBe('"San Francisco"}');

        const toolBlock = result.state.contentBlocks.get("func_123");
        expect(toolBlock?.content).toBe('{"location":"San Francisco"}');
      });

      it("should complete function call on output item done", () => {
        const stateWithTool: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "func_123",
              {
                id: "func_123",
                type: "tool_use",
                index: 0,
                name: "get_weather",
                content: '{"location":"San Francisco"}',
                started: true,
                completed: false,
              },
            ],
          ]),
        };

        const event: ResponseOutputItemDoneEvent = {
          type: "response.output_item.done",
          output_index: 0,
          sequence_number: 0,
          item: {
            type: "function_call",
            id: "func_123",
            call_id: "call_abc",
            name: "get_weather",
            arguments: '{"location":"San Francisco"}',
          },
        };

        const result = processOpenAIEvent(stateWithTool, event);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("content_block_stop");

        const toolBlock = result.state.contentBlocks.get("func_123");
        expect(toolBlock?.completed).toBe(true);
      });

      it("should handle function call arguments with missing item_id", () => {
        const event = {
          type: "response.function_call_arguments.delta",
          delta: '{"test": true}',
          item_id: "missing",
          output_index: 0,
          sequence_number: 0,
        };

        const result = processOpenAIEvent(initialState, createTestEvent(event));

        expect(result.events).toHaveLength(0);
        expect(result.state).toEqual(initialState);
      });
    });

    describe("Web search processing", () => {
      it("should create web search tool block", () => {
        // @ts-expect-error: Partial event for testing
        const event: ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          item: {
            type: "web_search_call",
            id: "search_123",
            status: "in_progress",
          },
        };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state.contentBlocks.size).toBe(1);
        expect(result.events).toHaveLength(1);

        const startEvent = result.events[0];
        expect(startEvent.type).toBe("content_block_start");
        const blockStartEvent = startEvent as { content_block: { type: string; name: string } };
        expect(blockStartEvent.content_block.type).toBe("tool_use");
        expect(blockStartEvent.content_block.name).toBe("web_search");
      });

      it("should complete web search with query", () => {
        const stateWithSearch: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "search_123",
              {
                id: "search_123",
                type: "tool_use",
                index: 0,
                name: "web_search",
                content: "",
                started: true,
                completed: false,
              },
            ],
          ]),
        };

        const event: ResponseOutputItemDoneEvent = {
          type: "response.output_item.done",
          output_index: 0,
          sequence_number: 0,
          item: {
            type: "web_search_call",
            id: "search_123",
            status: "completed",
          },
        };

        const result = processOpenAIEvent(stateWithSearch, event);

        expect(result.events).toHaveLength(2);
        expect(result.events[0].type).toBe("content_block_delta");
        const deltaEvent = result.events[0] as { delta: { type: string; partial_json: string } };
        expect(deltaEvent.delta.type).toBe("input_json_delta");
        expect(JSON.parse(deltaEvent.delta.partial_json)).toEqual({
          query: "AI developments 2024",
        });
        expect(result.events[1].type).toBe("content_block_stop");
      });
    });

    describe("Image generation processing", () => {
      it("should create image generation tool block", () => {
        const event: ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          output_index: 0,
          sequence_number: 0,
          item: {
            type: "image_generation_call",
            id: "img_123",
            status: "in_progress",
            result: null,
          },
        };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state.contentBlocks.size).toBe(1);
        expect(result.events).toHaveLength(1);

        const startEvent = result.events[0];
        const blockStartEvent = startEvent as { content_block: { name: string } };
        expect(blockStartEvent.content_block.name).toBe("generate_image");
      });

      it("should handle image generation status events", () => {
        const stateWithImage: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "img_123",
              {
                id: "img_123",
                type: "tool_use",
                index: 0,
                name: "generate_image",
                content: "",
                started: true,
                completed: false,
              },
            ],
          ]),
        };

        // @ts-expect-error: Partial event for testing
        const event: OpenAIResponseStreamEvent = {
          type: "response.image_generation_call.generating",
          item_id: "img_123",
        };

        const result = processOpenAIEvent(stateWithImage, event);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("content_block_delta");
        const deltaEvent = result.events[0] as { delta: { partial_json: string } };
        expect(JSON.parse(deltaEvent.delta.partial_json)).toEqual({
          status: "generating",
        });
      });
    });

    describe("Code interpreter processing", () => {
      it("should create code interpreter tool block", () => {
        const event: ResponseOutputItemAddedEvent = {
          type: "response.output_item.added",
          output_index: 0,
          sequence_number: 0,
          item: {
            type: "code_interpreter_call",
            id: "code_123",
            status: "in_progress",
            code: "",
            container_id: "",
            outputs: [],
          },
        };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state.contentBlocks.size).toBe(1);
        expect(result.events).toHaveLength(1);

        const startEvent = result.events[0];
        const blockStartEvent = startEvent as { content_block: { name: string } };
        expect(blockStartEvent.content_block.name).toBe("str_replace_based_edit_tool");
      });

      it("should handle code delta events", () => {
        const stateWithCode: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "code_123",
              {
                id: "code_123",
                type: "tool_use",
                index: 0,
                name: "str_replace_based_edit_tool",
                content: "",
                started: true,
                completed: false,
              },
            ],
          ]),
        };

        // @ts-expect-error: Partial event for testing
        const event: OpenAIResponseStreamEvent = {
          type: "response.code_interpreter_call_code.delta",
          delta: "print('hello')",
          item_id: "code_123",
        };

        const result = processOpenAIEvent(stateWithCode, event);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("content_block_delta");
        const deltaEvent = result.events[0] as { delta: { partial_json: string } };
        expect(JSON.parse(deltaEvent.delta.partial_json)).toEqual({
          code_delta: "print('hello')",
        });
      });
    });

    describe("Response completion", () => {
      it("should handle response completed with usage", () => {
        const event: ResponseCompletedEvent = {
          type: "response.completed",
          sequence_number: 0,
          response: {
            id: "resp_123",
            status: "completed",
            created_at: Date.now(),
            model: "",
            output_text: "",
            error: null,
            incomplete_details: null,
            instructions: "",
            max_output_tokens: 1000,
            metadata: null,
            output: [],
            temperature: 1,
            object: "response" as const,
            parallel_tool_calls: false,
            tool_choice: "auto" as const,
            tools: [],
            top_p: 1,
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
              total_tokens: 150,
            },
          },
        };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state.usage.input_tokens).toBe(100);
        expect(result.state.usage.output_tokens).toBe(50);
        expect(result.events).toHaveLength(2);

        const deltaEvent = result.events[0];
        expect(deltaEvent.type).toBe("message_delta");
        const messageDelta = deltaEvent as { delta: { stop_reason: string }; usage: { output_tokens: number } };
        expect(messageDelta.delta.stop_reason).toBe("end_turn");
        expect(messageDelta.usage.output_tokens).toBe(50);

        const stopEvent = result.events[1];
        expect(stopEvent.type).toBe("message_stop");
      });

      it("should detect tool_use stop reason when tools are present", () => {
        const stateWithTool: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "func_123",
              {
                id: "func_123",
                type: "tool_use",
                index: 0,
                name: "get_weather",
                content: "{}",
                started: true,
                completed: true,
              },
            ],
          ]),
        };

        const event: ResponseCompletedEvent = {
          type: "response.completed",
          sequence_number: 0,
          response: {
            id: "resp_123",
            status: "completed",
            created_at: Date.now(),
            model: "",
            output_text: "",
            error: null,
            incomplete_details: null,
            instructions: "",
            max_output_tokens: 1000,
            metadata: null,
            output: [],
            temperature: 1,
            object: "response" as const,
            parallel_tool_calls: false,
            tool_choice: "auto" as const,
            tools: [],
            top_p: 1,
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
              total_tokens: 150,
            },
          },
        };

        const result = processOpenAIEvent(stateWithTool, event);

        const messageDelta = result.events[0] as { delta: { stop_reason: string } };
        expect(messageDelta.delta.stop_reason).toBe("tool_use");
      });

      it("should detect max_tokens stop reason", () => {
        const event: ResponseCompletedEvent = {
          type: "response.completed",
          sequence_number: 0,
          response: {
            id: "resp_123",
            status: "incomplete",
            created_at: Date.now(),
            model: "",
            output_text: "",
            error: null,
            incomplete_details: {
              reason: "max_output_tokens",
            },
            instructions: "",
            max_output_tokens: 1000,
            metadata: null,
            output: [],
            temperature: 1,
            object: "response" as const,
            parallel_tool_calls: false,
            tool_choice: "auto" as const,
            tools: [],
            top_p: 1,
            usage: {
              input_tokens: 100,
              output_tokens: 4000,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
              total_tokens: 4100,
            },
          },
        };

        const result = processOpenAIEvent(initialState, event);

        const messageDelta = result.events[0] as { delta: { stop_reason: string } };
        expect(messageDelta.delta.stop_reason).toBe("max_tokens");
      });
    });

    describe("Response lifecycle events", () => {
      it("should handle response created event", () => {
        // @ts-expect-error: Partial event for testing
        const event: OpenAIResponseStreamEvent = { type: "response.created" };

        const result = processOpenAIEvent(initialState, event);

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("message_start");
        const messageStart = result.events[0] as { message: { role: string; content: unknown[] } };
        expect(messageStart.message.role).toBe("assistant");
        expect(messageStart.message.content).toEqual([]);
      });

      it("should handle response in progress event", () => {
        const originalDebug = console.debug;
        const debugCalls: unknown[][] = [];
        console.debug = (...args: unknown[]) => debugCalls.push(args);
        // @ts-expect-error: Partial event for testing
        const event: OpenAIResponseStreamEvent = { type: "response.in_progress" };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state).toEqual(initialState);
        expect(result.events).toHaveLength(0);
        expect(debugCalls.length).toBeGreaterThan(0);

        console.debug = originalDebug;
      });
    });

    describe("Unknown and skipped events", () => {
      it("should skip content part events", () => {
        const events = ["response.content_part.added", "response.content_part.done"];

        events.forEach((eventType) => {
          const event: OpenAIResponseStreamEvent = { type: eventType } as OpenAIResponseStreamEvent;
          const result = processOpenAIEvent(initialState, event);

          expect(result.state).toEqual(initialState);
          expect(result.events).toHaveLength(0);
        });
      });

      it("should warn about unknown event types", () => {
        const originalWarn = console.warn;
        const warnCalls: unknown[][] = [];
        console.warn = (...args: unknown[]) => warnCalls.push(args);
        // @ts-expect-error: Partial event for testing
        const event: OpenAIResponseStreamEvent = { type: "unknown.event.type" };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state).toEqual(initialState);
        expect(result.events).toHaveLength(0);
        expect(warnCalls.length).toBeGreaterThan(0);
        expect(warnCalls[0][0]).toEqual(expect.stringContaining("Unknown event type: unknown.event.type"));

        console.warn = originalWarn;
      });

      it("should handle text annotation events gracefully", () => {
        // @ts-expect-error: Partial event for testing
        const event: OpenAIResponseStreamEvent = { type: "response.output_text.annotation.added" };

        const result = processOpenAIEvent(initialState, event);

        expect(result.state).toEqual(initialState);
        expect(result.events).toHaveLength(0);
      });
    });

    describe("Error conditions", () => {
      it("should handle missing tool block for arguments delta", () => {
        // @ts-expect-error: Partial event for testing
        const event: ResponseFunctionCallArgumentsDeltaEvent = {
          type: "response.function_call_arguments.delta",
          delta: '{"test": true}',
          item_id: "nonexistent_id",
        };

        const result = processOpenAIEvent(initialState, event);

        expect(result.events).toHaveLength(0);
        expect(result.state).toEqual(initialState);
      });

      it("should handle completed tool block for arguments delta", () => {
        const stateWithCompletedTool: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "func_123",
              {
                id: "func_123",
                type: "tool_use",
                index: 0,
                name: "test_tool",
                content: "{}",
                started: true,
                completed: true, // Already completed
              },
            ],
          ]),
        };

        // @ts-expect-error: Partial event for testing
        const event: ResponseFunctionCallArgumentsDeltaEvent = {
          type: "response.function_call_arguments.delta",
          delta: '{"extra": "data"}',
          item_id: "func_123",
        };

        const result = processOpenAIEvent(stateWithCompletedTool, event);

        expect(result.events).toHaveLength(0);
        // State should be unchanged since tool is already completed
        expect(result.state.contentBlocks.get("func_123")?.content).toBe("{}");
      });

      it("should handle tool completion for already completed block", () => {
        const stateWithCompletedTool: ConversionState = {
          ...initialState,
          contentBlocks: new Map([
            [
              "func_123",
              {
                id: "func_123",
                type: "tool_use",
                index: 0,
                name: "test_tool",
                content: "{}",
                started: true,
                completed: true,
              },
            ],
          ]),
        };

        const event: ResponseOutputItemDoneEvent = {
          type: "response.output_item.done",
          output_index: 0,
          sequence_number: 0,
          item: {
            type: "function_call",
            id: "func_123",
            call_id: "call_abc",
            name: "test_tool",
            arguments: "{}",
          },
        };

        const result = processOpenAIEvent(stateWithCompletedTool, event);

        expect(result.events).toHaveLength(0);
      });
    });
  });
});
