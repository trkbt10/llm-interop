/**
 * @file Tests for Claude to OpenAI Response API input conversion utilities
 */
import type {
  ImageBlockParam,
  URLImageSource,
  Base64ImageSource,
  ToolResultBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages";
import { convertClaudeImageToOpenAI } from "./image-converter";
import { convertToolResult } from "./tool-result-converter";
import { convertClaudeMessage } from "./message-converter";

describe("Claude to OpenAI Response API input converters", () => {
  describe("Image conversion", () => {
    test("convertClaudeImageToOpenAI base64", () => {
      const img: ImageBlockParam = {
        type: "image",
        source: { type: "base64", data: "aGVsbG8gd29ybGQ=", media_type: "image/jpeg" } as Base64ImageSource,
      };
      const res = convertClaudeImageToOpenAI(img);
      expect(res).toEqual({
        type: "input_image",
        image_url: "data:image/jpeg;base64,aGVsbG8gd29ybGQ=",
        detail: "auto",
      });
    });

    test("convertClaudeImageToOpenAI url", () => {
      const img: ImageBlockParam = {
        type: "image",
        source: { type: "url", url: "https://example.com/img.jpg" } as URLImageSource,
      };
      const res = convertClaudeImageToOpenAI(img);
      expect(res).toEqual({ type: "input_image", image_url: "https://example.com/img.jpg", detail: "auto" });
    });
  });

  describe("Tool result conversion", () => {
    test("convertToolResult deterministic call_id", () => {
      const toolRes: ToolResultBlockParam = { type: "tool_result", tool_use_id: "tool_1", content: "ok" };
      expect(convertToolResult(toolRes)).toEqual({
        id: "fc_1",
        type: "function_call_output",
        call_id: "call_1",
        output: "ok",
      });
    });

    test("should generate function_call_output with fc_ prefix for id field", () => {
      const toolResult: ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: "toolu_123456789",
        content: "Weather in Tokyo: 22°C",
      };

      const result = convertToolResult(toolResult);

      // This test currently fails because id has call_ prefix instead of fc_
      expect(result.id).toMatch(/^fc_/);
      expect(result.call_id).toMatch(/^call_/);
      expect(result.type).toBe("function_call_output");
      expect(result.output).toBe("Weather in Tokyo: 22°C");
    });

    test("should maintain consistent ID relationship between id and call_id", () => {
      const toolResult: ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: "toolu_abcdef123",
        content: "Test output",
      };

      const result = convertToolResult(toolResult);

      // Both should have the same suffix, just different prefixes
      const idSuffix = result.id.replace(/^fc_/, "");
      const callIdSuffix = result.call_id.replace(/^call_/, "");

      expect(idSuffix).toBe(callIdSuffix);
    });

    test("should handle complex content serialization", () => {
      const toolResult: ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: "toolu_xyz789",
        content: [{ type: "text", text: JSON.stringify({ temperature: 22, condition: "cloudy" }) }],
      };

      const result = convertToolResult(toolResult);

      expect(result.id).toMatch(/^fc_/);
      expect(result.output).toBe('[{"type":"text","text":"{\\"temperature\\":22,\\"condition\\":\\"cloudy\\"}"}]');
    });
  });

  describe("Message conversion", () => {
    test("convertClaudeMessage assistant text + tool_use", () => {
      const msg: MessageParam = {
        role: "assistant",
        content: [
          { type: "text", text: "Hello." },
          { type: "tool_use", id: "tool_a", name: "calc", input: { a: 1 } },
        ],
      };
      const res = convertClaudeMessage(msg);
      expect(res).toEqual([
        { role: "assistant", content: "Hello." },
        { type: "function_call", call_id: "call_a", name: "calc", arguments: JSON.stringify({ a: 1 }) },
      ]);
    });

    test("convertClaudeMessage user text/image/tool_result", () => {
      const msg: MessageParam = {
        role: "user",
        content: [
          { type: "text", text: "A" },
          { type: "text", text: "B" },
          { type: "image", source: { type: "url", url: "https://example.com/i.png" } as URLImageSource },
          { type: "tool_result", tool_use_id: "tool_x", content: "R" },
        ],
      };
      const res = convertClaudeMessage(msg);
      expect(res).toEqual([
        {
          role: "user",
          content: [
            { type: "input_text", text: "A" },
            { type: "input_text", text: "B" },
          ],
        },
        { role: "user", content: [{ type: "input_image", image_url: "https://example.com/i.png", detail: "auto" }] },
        { id: "fc_x", type: "function_call_output", call_id: "call_x", output: "R" },
      ]);
    });
  });
});
