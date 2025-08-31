/**
 * @file Tests for developer message generation.
 */
import { generateDeveloperMessage } from "./generate-developer-message";
import type { ResponseCreateParamsBase } from "../../types";

describe("generateDeveloperMessage", () => {
  it("should return null when no relevant params", () => {
    const params: ResponseCreateParamsBase = {};
    expect(generateDeveloperMessage(params)).toBeUndefined();
  });

  it("should generate message with instructions only", () => {
    const params: ResponseCreateParamsBase = {
      instructions: "Be helpful and concise.",
    };
    const result = generateDeveloperMessage(params);

    expect(result).toContain("<|start|>developer<|message|>");
    expect(result).toContain("# Instructions");
    expect(result).toContain("Be helpful and concise.");
    expect(result).toContain("<|end|>");
  });

  it("should generate message with tools only", () => {
    const params: ResponseCreateParamsBase = {
      tools: [
        {
          type: "function",
          name: "get_weather",
          description: "Get weather info",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
          },
          strict: null,
        },
      ],
    };
    const result = generateDeveloperMessage(params);

    expect(result).toContain("# Tools");
    expect(result).toContain("namespace functions {");
    expect(result).toContain("// Get weather info");
    expect(result).toContain("type get_weather = (_: {");
  });

  it("should generate message with response format", () => {
    const params: ResponseCreateParamsBase = {
      // Testing response_format nested incorrectly under 'text' property
      // ResponseTextConfig expects response_format at root level, not nested
      text: {
        // @ts-expect-error - Testing response_format nested incorrectly under 'text' property
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "user_info",
            description: "User information",
            schema: { type: "object" },
          },
        },
      },
    };
    const result = generateDeveloperMessage(params);

    expect(result).toContain("# Response Formats");
    expect(result).toContain("## user_info");
    expect(result).toContain("// User information");
  });

  it("should combine instructions and tools", () => {
    const params: ResponseCreateParamsBase = {
      instructions: "Use tools wisely.",
      tools: [
        // Testing incomplete FunctionTool without required field 'parameters'
        // This tests handling of minimal function tool definitions at runtime
        // @ts-expect-error - Testing incomplete FunctionTool without required field 'parameters'
        { type: "function", name: "test_func", strict: null },
      ],
    };
    const result = generateDeveloperMessage(params);

    expect(result).toContain("# Instructions");
    expect(result).toContain("Use tools wisely.");
    expect(result).toContain("# Tools");
    expect(result).toContain("namespace functions {");
  });

  it("should add tool choice instructions", () => {
    const params: ResponseCreateParamsBase = {
      instructions: "Be helpful.",
      tool_choice: "required",
    };
    const result = generateDeveloperMessage(params);

    expect(result).toContain("# Instructions");
    expect(result).toContain("Be helpful.");
    expect(result).toContain("You MUST call at least one tool function. Do not respond directly without using tools.");
  });

  it("should add tool choice instructions without other instructions", () => {
    const params: ResponseCreateParamsBase = {
      tool_choice: { type: "function", name: "get_weather" },
    };
    const result = generateDeveloperMessage(params);

    expect(result).toContain("# Instructions");
    expect(result).toContain("You must use the get_weather function.");
  });

  it("should combine all sections", () => {
    const params: ResponseCreateParamsBase = {
      instructions: "Follow these rules.",
      tool_choice: "none",
      tools: [
        // Testing incomplete FunctionTool without required field 'parameters'
        // This tests handling of function tools with only name and description
        // @ts-expect-error - Testing incomplete FunctionTool without required field 'parameters'
        { type: "function", name: "func1", description: "Function 1", strict: null },
      ],
      // Testing response_format nested incorrectly under 'text' property
      // ResponseTextConfig expects response_format at root level, not nested
      text: {
        // @ts-expect-error - Testing response_format nested incorrectly under 'text' property
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            schema: { type: "object" },
          },
        },
      },
    };
    const result = generateDeveloperMessage(params);

    // Check order
    const instructionIndex = result!.indexOf("# Instructions");
    const toolsIndex = result!.indexOf("# Tools");
    const responseFormatIndex = result!.indexOf("# Response Formats");

    expect(instructionIndex).toBeGreaterThan(-1);
    expect(toolsIndex).toBeGreaterThan(instructionIndex);
    expect(responseFormatIndex).toBeGreaterThan(toolsIndex);

    // Check content
    expect(result).toContain("Follow these rules.");
    expect(result).toContain("Do not use any tools.");
    expect(result).toContain("// Function 1");
    expect(result).toContain("## output");
  });

  it("should handle empty tools array", () => {
    const params: ResponseCreateParamsBase = {
      instructions: "Test",
      tools: [],
    };
    const result = generateDeveloperMessage(params);

    expect(result).toContain("# Instructions");
    expect(result).not.toContain("# Tools");
  });
});
