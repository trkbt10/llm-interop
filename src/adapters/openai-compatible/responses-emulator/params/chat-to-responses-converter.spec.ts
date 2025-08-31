/**
 * @file Tests for ChatCompletionCreateParams to ResponseCreateParams conversion
 */
import { convertChatParamsToResponseParams } from "./chat-to-responses-converter";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";

describe("convertChatParamsToResponseParams", () => {
  describe("basic conversion", () => {
    it("should convert minimal chat params to response params", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result).toEqual({
        model: "gpt-4",
        stream: false,
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Hello" }],
          },
        ],
      });
    });

    it("should handle streaming params", () => {
      const chatParams: ChatCompletionCreateParamsStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.stream).toBe(true);
      expect(result.model).toBe("gpt-4");
    });

    it("should default stream to false when not specified", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.stream).toBe(false);
    });
  });

  describe("optional parameter conversion", () => {
    it("should convert temperature parameter", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.7,
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.temperature).toBe(0.7);
    });

    it("should convert top_p parameter", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        top_p: 0.9,
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.top_p).toBe(0.9);
    });

    it("should convert max_tokens to max_output_tokens", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 1000,
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.max_output_tokens).toBe(1000);
      expect("max_tokens" in result).toBe(false);
    });

    it("should convert metadata parameter", () => {
      const metadata = { user_id: "123", session: "abc" };
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        metadata,
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.metadata).toEqual(metadata);
    });

    it("should not include undefined optional parameters", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect("temperature" in result).toBe(false);
      expect("top_p" in result).toBe(false);
      expect("max_output_tokens" in result).toBe(false);
      expect("metadata" in result).toBe(false);
    });
  });

  describe("tools conversion", () => {
    it("should convert tools parameter", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get weather info",
              parameters: {
                type: "object",
                properties: { location: { type: "string" } },
              },
            },
          },
        ],
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toEqual({
        type: "function",
        name: "get_weather",
        description: "Get weather info",
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
        },
        strict: false,
      });
    });

    it("should handle empty tools array", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        tools: [],
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect("tools" in result).toBe(false);
    });

    it("should handle invalid tools", () => {
      const chatParams = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        tools: [{ type: "not_function", function: { name: "invalid" } }],
      };

      // @ts-expect-error: Intentionally passing invalid tool type
      const result = convertChatParamsToResponseParams(chatParams);

      expect("tools" in result).toBe(false);
    });
  });

  describe("tool_choice conversion", () => {
    it("should convert string tool_choice values", () => {
      const testCases = ["auto", "none", "required"] as const;

      for (const choice of testCases) {
        const chatParams: ChatCompletionCreateParamsNonStreaming = {
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
          tool_choice: choice,
        };

        const result = convertChatParamsToResponseParams(chatParams);
        const toolChoice = (result as { tool_choice?: unknown }).tool_choice;
        expect(toolChoice).toBe(choice);
      }
    });

    it("should convert function tool_choice", () => {
      const chatParams = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        tool_choice: {
          type: "function",
          function: { name: "specific_function" },
        },
      };

      // @ts-expect-error: Intentionally passing function tool_choice for conversion
      const result = convertChatParamsToResponseParams(chatParams);
      const toolChoice = (result as { tool_choice?: { type: string; name?: string } }).tool_choice;
      expect(toolChoice).toEqual({
        type: "function",
        name: "specific_function",
      });
    });

    it("should handle invalid tool_choice", () => {
      const chatParams = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        tool_choice: { type: "invalid", function: { name: "test" } },
      };

      // @ts-expect-error: Intentionally passing invalid tool_choice shape
      const result = convertChatParamsToResponseParams(chatParams);

      expect("tool_choice" in result).toBe(false);
    });
  });

  describe("complex scenarios", () => {
    it("should handle full parameter conversion", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "What's the weather?" },
          { role: "assistant", content: "I'll check for you" },
        ],
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 500,
        metadata: { session_id: "session123" },
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get current weather",
              parameters: {
                type: "object",
                properties: {
                  location: { type: "string" },
                  units: { type: "string", enum: ["celsius", "fahrenheit"] },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "auto",
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result).toEqual({
        model: "gpt-4",
        stream: false,
        input: [
          {
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: "You are helpful" }],
          },
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "What's the weather?" }],
          },
          {
            type: "message",
            role: "assistant",
            content: [{ type: "input_text", text: "I'll check for you" }],
          },
        ],
        temperature: 0.8,
        top_p: 0.95,
        max_output_tokens: 500,
        metadata: { session_id: "session123" },
        tools: [
          {
            type: "function",
            name: "get_weather",
            description: "Get current weather",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
                units: { type: "string", enum: ["celsius", "fahrenheit"] },
              },
              required: ["location"],
            },
            strict: false,
          },
        ],
        tool_choice: "auto",
      });
    });

    it("should handle streaming with tools", () => {
      const chatParams: ChatCompletionCreateParamsStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
        tools: [
          {
            type: "function",
            function: { name: "test_tool" },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "test_tool" },
        },
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.stream).toBe(true);
      expect(result.tools).toHaveLength(1);
      expect(result.tool_choice).toEqual({
        type: "function",
        name: "test_tool",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle messages with mixed content types", () => {
      const chatParams = {
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Hello " },
              { type: "image_url", image_url: { url: "test.jpg" } },
              { type: "text", text: "world" },
            ],
          },
        ],
      };

      // @ts-expect-error: Intentionally passing mixed content parts
      const result = convertChatParamsToResponseParams(chatParams);
      const projected = result as { input?: Array<{ content?: unknown }> };
      expect(projected.input?.[0]?.content).toEqual([{ type: "input_text", text: "Hello world" }]);
    });

    it("should handle empty messages array", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [],
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.input).toEqual([]);
    });

    it("should preserve parameter order and types", () => {
      const chatParams: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-4",
        messages: [{ role: "user", content: "Test" }],
        temperature: 0,
        top_p: 1,
        max_tokens: 0,
      };

      const result = convertChatParamsToResponseParams(chatParams);

      expect(result.temperature).toBe(0);
      expect(result.top_p).toBe(1);
      expect(result.max_output_tokens).toBe(0);
    });
  });
});
