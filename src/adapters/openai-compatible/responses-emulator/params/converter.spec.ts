/**
 * @file Tests for Chat Completions to Responses API parameter conversion utilities
 */

import {
  extractTextFromContent,
  mapChatToolsToResponses,
  convertOpenAIChatToolToResponsesTool,
  mapChatToolChoiceToResponses,
  buildResponseInputFromChatMessages,
} from "./converter";
import type { ChatCompletionTool, ChatCompletionContentPart } from "openai/resources/chat/completions";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { isResponseInputMessage } from "../harmony/utils/type-guards";

describe("converter utilities", () => {
  describe("extractTextFromContent", () => {
    it("should extract text from string content", () => {
      const content = "Hello world";
      const result = extractTextFromContent(content);
      expect(result).toBe("Hello world");
    });

    it("should handle empty string content", () => {
      const content = "";
      const result = extractTextFromContent(content);
      expect(result).toBe("");
    });

    it("should extract text from array of text parts", () => {
      const content: ChatCompletionContentPart[] = [
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ];
      const result = extractTextFromContent(content);
      expect(result).toBe("Hello world");
    });

    it("should filter out non-text parts from array", () => {
      const content: ChatCompletionContentPart[] = [
        { type: "text", text: "Hello " },
        { type: "image_url", image_url: { url: "test.jpg" } },
        { type: "text", text: "world" },
      ];
      const result = extractTextFromContent(content);
      expect(result).toBe("Hello world");
    });

    it("should handle array with only non-text parts", () => {
      const content = [{ type: "image_url", image_url: { url: "test.jpg" } }];
      const result = extractTextFromContent(content as never);
      expect(result).toBe("");
    });

    it("should handle empty array", () => {
      const content: ChatCompletionContentPart[] = [];
      const result = extractTextFromContent(content);
      expect(result).toBe("");
    });

    it("should handle null/undefined content", () => {
      expect(extractTextFromContent(null as never)).toBe("");
      expect(extractTextFromContent(undefined as never)).toBe("");
    });
  });

  describe("mapChatToolsToResponses", () => {
    it("should return undefined for undefined input", () => {
      const result = mapChatToolsToResponses(undefined);
      expect(result).toBeUndefined();
    });

    it("should return undefined for non-array input", () => {
      const result = mapChatToolsToResponses("not-array" as never);
      expect(result).toBeUndefined();
    });

    it("should convert function tools to response format", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather information",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
              required: ["location"],
            },
          },
        },
      ];

      const result = mapChatToolsToResponses(tools as never);

      expect(result).toHaveLength(1);
      expect(result![0]).toEqual({
        type: "function",
        name: "get_weather",
        description: "Get weather information",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
        strict: false,
      });
    });

    it("should handle tool without description", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "simple_tool",
            parameters: { type: "object" },
          },
        },
      ];

      const result = mapChatToolsToResponses(tools as never);

      expect((result![0] as { description?: string }).description).toBeUndefined();
      expect((result![0] as { name: string }).name).toBe("simple_tool");
    });

    it("should handle tool with invalid parameters", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "tool_with_invalid_params",
            parameters: "invalid",
          },
        },
      ];

      const result = mapChatToolsToResponses(tools as never);

      expect((result![0] as { parameters: unknown }).parameters).toBeUndefined();
    });

    it("should filter out non-function tools", () => {
      const tools = [
        {
          type: "function",
          function: { name: "valid_tool" },
        },
        {
          type: "not_function",
          function: { name: "invalid_tool" },
        },
      ];

      const result = mapChatToolsToResponses(tools as never);

      expect(result).toHaveLength(1);
      expect((result![0] as { name?: string }).name).toBe("valid_tool");
    });

    it("should return undefined for empty array after filtering", () => {
      const tools = [
        {
          type: "not_function",
          function: { name: "invalid_tool" },
        },
      ];

      const result = mapChatToolsToResponses(tools as never);

      expect(result).toBeUndefined();
    });
  });

  describe("convertOpenAIChatToolToResponsesTool", () => {
    it("should convert valid function tool", () => {
      const tool: ChatCompletionTool = {
        type: "function",
        function: {
          name: "test_function",
          description: "Test function",
          parameters: {
            type: "object",
            properties: { param1: { type: "string" } },
          },
        },
      };

      const result = convertOpenAIChatToolToResponsesTool(tool);

      expect(result).toEqual({
        type: "function",
        name: "test_function",
        description: "Test function",
        parameters: {
          type: "object",
          properties: { param1: { type: "string" } },
        },
        strict: false,
      });
    });

    it("should return undefined for non-function tool", () => {
      const tool = {
        type: "not_function",
        function: { name: "test" },
      };

      const result = convertOpenAIChatToolToResponsesTool(tool as never);

      expect(result).toBeUndefined();
    });

    it("should handle tool without description", () => {
      const tool: ChatCompletionTool = {
        type: "function",
        function: {
          name: "no_desc_tool",
        },
      };

      const result = convertOpenAIChatToolToResponsesTool(tool);

      const proj = result as { description?: string; name?: string };
      expect(proj.description).toBeUndefined();
      expect(proj.name).toBe("no_desc_tool");
    });
  });

  describe("mapChatToolChoiceToResponses", () => {
    it("should return undefined for undefined input", () => {
      const result = mapChatToolChoiceToResponses(undefined);
      expect(result).toBeUndefined();
    });

    it("should pass through string choices", () => {
      expect(mapChatToolChoiceToResponses("auto")).toBe("auto");
      expect(mapChatToolChoiceToResponses("none")).toBe("none");
      expect(mapChatToolChoiceToResponses("required")).toBe("required");
    });

    it("should convert function tool choice", () => {
      const toolChoice = {
        type: "function",
        function: { name: "specific_tool" },
      };

      const result = mapChatToolChoiceToResponses(toolChoice as never);

      expect(result).toEqual({
        type: "function",
        name: "specific_tool",
      });
    });

    it("should return undefined for invalid function tool choice", () => {
      const invalidChoices = [
        { type: "function", function: { name: 123 } },
        { type: "function", function: {} },
        { type: "function" },
        { type: "not_function", function: { name: "test" } },
      ];

      for (const choice of invalidChoices) {
        const result = mapChatToolChoiceToResponses(choice as never);
        expect(result).toBeUndefined();
      }
    });
  });

  describe("buildResponseInputFromChatMessages", () => {
    it("should handle undefined messages", () => {
      const result = buildResponseInputFromChatMessages(undefined);
      expect(result).toEqual([]);
    });

    it("should handle non-array messages", () => {
      const result = buildResponseInputFromChatMessages("not-array" as never);
      expect(result).toEqual([]);
    });

    it("should convert basic chat messages", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "system", content: "You are helpful" },
      ];

      const result = buildResponseInputFromChatMessages(messages as never);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Hello" }],
      });
      expect(result[1]).toEqual({
        type: "message",
        role: "assistant",
        content: [{ type: "input_text", text: "Hi there" }],
      });
      expect(result[2]).toEqual({
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: "You are helpful" }],
      });
    });

    it("should handle messages with empty content", () => {
      const messages = [{ role: "user", content: "" }];

      const result = buildResponseInputFromChatMessages(messages as never);

      expect(result).toHaveLength(1);
      const first = result[0] as ResponseInputItem;
      expect(isResponseInputMessage(first) ? (first as { content: unknown[] }).content : []).toEqual([]);
    });

    it("should handle messages with array content", () => {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: "Look at this: " },
            { type: "text", text: "Amazing!" },
          ],
        },
      ];

      const result = buildResponseInputFromChatMessages(messages as never);

      expect(result).toHaveLength(1);
      const first = result[0] as ResponseInputItem;
      expect(isResponseInputMessage(first) ? (first as { content: unknown[] }).content : []).toEqual([
        { type: "input_text", text: "Look at this: Amazing!" },
      ]);
    });

    it("should filter out messages with invalid roles", () => {
      const messages = [
        { role: "user", content: "Valid message" },
        { role: "invalid_role", content: "Invalid message" },
        { role: "function", content: "Function message" },
      ];

      const result = buildResponseInputFromChatMessages(messages as never);

      expect(result).toHaveLength(1);
      expect((result[0] as { role?: string }).role).toBe("user");
    });

    it("should handle empty messages array", () => {
      const result = buildResponseInputFromChatMessages([]);
      expect(result).toEqual([]);
    });
  });
});
