/**
 * @file Tests for OpenAI non-streaming response to Claude message conversion
 */

import { openAINonStreamToClaudeMessage } from "./from-nonstream";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

// Mock response type removed as it's not used

describe("from-nonstream", () => {
  describe("openAINonStreamToClaudeMessage", () => {
    it("should convert basic text response to Claude message", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_123",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [
          {
            id: "msg_123",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "Hello world!",
                annotations: [],
              },
            ],
          },
        ],
        output_text: "Hello world!",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_123", "claude-3");

      expect(result.id).toBe("msg_123");
      expect(result.type).toBe("message");
      expect(result.role).toBe("assistant");
      expect(result.model).toBe("claude-3");
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: "Hello world!",
        citations: null,
      });
      expect(result.stop_reason).toBe("end_turn");
      expect(result.usage).toEqual({
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        cache_creation: null,
        server_tool_use: null,
        service_tier: null,
      });
    });

    it("should handle function calls in response", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_124",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [
          {
            id: "func_124",
            type: "function_call",
            name: "get_weather",
            arguments: '{"location": "New York"}',
            call_id: "call_123",
            status: "completed",
          },
        ],
        output_text: "",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 15,
          output_tokens: 25,
          total_tokens: 40,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_124", "claude-3");

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("tool_use");
      expect((result.content[0] as { name: string }).name).toBe("get_weather");
      expect((result.content[0] as { id: string }).id).toBe("call_123");
      expect((result.content[0] as { input: unknown }).input).toEqual({ location: "New York" });
      expect(result.stop_reason).toBe("tool_use");
    });

    it("should handle empty responses", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_125",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [],
        output_text: "",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 12,
          output_tokens: 0,
          total_tokens: 12,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_125", "claude-3");

      expect(result.id).toBe("msg_125");
      expect(result.content).toHaveLength(0);
      expect(result.stop_reason).toBe("end_turn");
    });

    it("should handle responses with multiple function calls", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_126",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [
          {
            id: "func1_126",
            type: "function_call",
            name: "get_weather",
            arguments: '{"location": "Tokyo"}',
            call_id: "call_1",
            status: "completed",
          },
          {
            id: "func2_126",
            type: "function_call",
            name: "get_time",
            arguments: '{"timezone": "JST"}',
            call_id: "call_2",
            status: "completed",
          },
        ],
        output_text: "",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 20,
          output_tokens: 30,
          total_tokens: 50,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_126", "claude-3");

      expect(result.id).toBe("msg_126");
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe("tool_use");
      expect(result.content[1].type).toBe("tool_use");
      expect(result.stop_reason).toBe("tool_use");
    });

    it("should handle mixed content (text and function calls)", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_127",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [
          {
            id: "msg_127",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "I'll help you get the weather.",
                annotations: [],
              },
            ],
          },
          {
            id: "func_127",
            type: "function_call",
            name: "get_weather",
            arguments: '{"location": "San Francisco"}',
            call_id: "call_127",
            status: "completed",
          },
        ],
        output_text: "I'll help you get the weather.",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 25,
          output_tokens: 35,
          total_tokens: 60,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_127", "claude-3");

      expect(result.id).toBe("msg_127");
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0]).toEqual({
        type: "text",
        text: "I'll help you get the weather.",
        citations: null,
      });
      expect(result.content[1].type).toBe("tool_use");
      expect((result.content[1] as { name: string }).name).toBe("get_weather");
      expect(result.stop_reason).toBe("tool_use");
    });

    it("should handle incomplete responses with max tokens", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_128",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "incomplete",
        output: [
          {
            id: "msg_128",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "This is a long response that got cut off...",
                annotations: [],
              },
            ],
          },
        ],
        output_text: "This is a long response that got cut off...",
        error: null,
        incomplete_details: {
          reason: "max_output_tokens",
        },
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 20,
          output_tokens: 100,
          total_tokens: 120,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_128", "claude-3");

      expect(result.stop_reason).toBe("max_tokens");
    });

    it("should handle responses without output", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_129",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [],
        output_text: "",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 5,
          output_tokens: 0,
          total_tokens: 5,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_129", "claude-3");

      expect(result.content).toHaveLength(0);
      expect(result.stop_reason).toBe("end_turn");
    });

    it("should handle responses without usage information", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_130",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [
          {
            id: "msg_130",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "Simple response",
                annotations: [],
              },
            ],
          },
        ],
        output_text: "Simple response",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: undefined,
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_130", "claude-3");

      expect(result.usage).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        cache_creation: null,
        server_tool_use: null,
        service_tier: null,
      });
    });

    it("should handle invalid JSON in tool arguments gracefully", () => {
      const openAIResponse: OpenAIResponse = {
        id: "resp_131",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        status: "completed",
        output: [
          {
            id: "func_131",
            type: "function_call",
            name: "test_function",
            arguments: "invalid json here",
            call_id: "call_131",
            status: "completed",
          },
        ],
        output_text: "",
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: null,
        tools: [],
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: null,
        top_p: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      };

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_131", "claude-3");

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("tool_use");
      expect((result.content[0] as { input: unknown }).input).toEqual({});
    });

    it("should handle multiple content blocks in correct order", () => {
      const openAIResponse = {
        id: "resp_132",
        object: "response",
        created_at: 1234567890,
        model: "gpt-4",
        output: [
          {
            id: "msg1_132",
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "First text block",
                annotations: [],
              },
            ],
            status: "completed",
          },
          {
            id: "func_132",
            type: "function_call",
            name: "test_tool",
            arguments: '{"param": "value"}',
            call_id: "call_132",
          },
          {
            id: "msg2_132",
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "Second text block",
                annotations: [],
              },
            ],
            status: "completed",
          },
        ],
        output_text: "First text block\nSecond text block",
        status: "completed",
        usage: {
          input_tokens: 30,
          output_tokens: 40,
        },
      } as OpenAIResponse;

      const result = openAINonStreamToClaudeMessage(openAIResponse, "msg_132", "claude-3");

      expect(result.content).toHaveLength(3);
      expect(result.content[0]).toEqual({
        type: "text",
        text: "First text block",
        citations: null,
      });
      expect(result.content[1].type).toBe("tool_use");
      expect((result.content[1] as { name: string }).name).toBe("test_tool");
      expect((result.content[1] as { input: unknown }).input).toEqual({ param: "value" });
      expect(result.content[2]).toEqual({
        type: "text",
        text: "Second text block",
        citations: null,
      });
      expect(result.stop_reason).toBe("tool_use");
    });
  });
});
