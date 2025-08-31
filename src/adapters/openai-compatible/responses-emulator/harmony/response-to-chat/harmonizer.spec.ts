/**
 * @file Tests for Harmony response harmonizer.
 */
import { harmonizeResponseParams } from "./harmonizer";
import { extractChatCompletionParams } from "../utils/extract-chat-params";
import type { ResponseCreateParamsBase } from "../types";
import {
  createFunctionTool,
  webSearchTool,
  codeInterpreterTool,
  createMessageInput,
  createResponseTextConfig,
  createToolChoiceFunction,
  createInvalidParams,
} from "../fixtures.test.support";

describe("harmonizeResponseParams", () => {
  // Note: Date-dependent tests would ideally be refactored to accept date as parameter
  // For now, tests work with any current date

  it("should generate minimal conversation with just system message", () => {
    const params: ResponseCreateParamsBase = {};
    const messages = harmonizeResponseParams(params);

    expect(messages).toHaveLength(2); // System + assistant prompt

    // Check system message
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("<|start|>system<|message|>");
    expect(messages[0].content).toContain("You are ChatGPT");
    expect(messages[0].content).toContain("Knowledge cutoff: 2024-06");
    expect(messages[0].content).toMatch(/Current date: \d{4}-\d{2}-\d{2}/);
    expect(messages[0].content).toContain("Reasoning: medium");

    // Check assistant prompt
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("<|start|>assistant");
  });

  it("should include developer message when instructions provided", () => {
    const params: ResponseCreateParamsBase = {
      instructions: "Be concise and helpful.",
    };
    const messages = harmonizeResponseParams(params);

    expect(messages).toHaveLength(3); // System + developer + assistant

    // Check developer message
    expect(messages[1].role).toBe("developer"); // Developer maps to developer
    expect(messages[1].content).toContain("<|start|>developer<|message|>");
    expect(messages[1].content).toContain("# Instructions");
    expect(messages[1].content).toContain("Be concise and helpful.");
  });

  it("should handle user input", () => {
    const params: ResponseCreateParamsBase = {
      input: "What is the weather like?",
    };
    const messages = harmonizeResponseParams(params);

    expect(messages).toHaveLength(3); // System + user + assistant

    // Check user message
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("<|start|>user<|message|>What is the weather like?<|end|>");
  });

  it("should handle function tools", () => {
    const params: ResponseCreateParamsBase = {
      instructions: "Use tools when needed.",
      tools: [
        createFunctionTool({
          name: "get_weather",
          description: "Gets the current weather",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
            required: ["location"],
          },
        }),
      ],
      input: "What is the weather in Tokyo?",
    };
    const messages = harmonizeResponseParams(params);

    expect(messages).toHaveLength(4); // System + developer + user + assistant

    // Check system message includes tool routing
    expect(messages[0].content).toContain("Calls to these tools must go to the commentary channel: 'functions'.");

    // Check developer message includes tools
    expect(messages[1].content).toContain("# Tools");
    expect(messages[1].content).toContain("namespace functions {");
    expect(messages[1].content).toContain("type get_weather = (_: {");
  });

  it("should handle built-in tools", () => {
    const params: ResponseCreateParamsBase = {
      tools: [webSearchTool, codeInterpreterTool],
    };
    const messages = harmonizeResponseParams(params);

    // Check system message includes built-in tools
    expect(messages[0].content).toContain("# Tools");
    expect(messages[0].content).toContain("## browser");
    expect(messages[0].content).toContain("namespace browser {");
    expect(messages[0].content).toContain("## python");
    expect(messages[0].content).toContain("Use this tool to execute Python code");
  });

  it("should handle reasoning effort", () => {
    const params: ResponseCreateParamsBase = {
      reasoning: { effort: "high" },
    };
    const messages = harmonizeResponseParams(params);

    expect(messages[0].content).toContain("Reasoning: high");
  });

  it("should handle tool choice", () => {
    const params: ResponseCreateParamsBase = {
      tool_choice: "required",
      tools: [createFunctionTool({ name: "test" })],
    };
    const messages = harmonizeResponseParams(params);

    // Tool choice instruction should be in developer message
    expect(messages[1].content).toContain(
      "You MUST call at least one tool function. Do not respond directly without using tools.",
    );
  });

  it("should handle response format", () => {
    const params: ResponseCreateParamsBase = {
      text: createResponseTextConfig(
        "user_data",
        {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
        },
        "User information",
      ),
    };
    const messages = harmonizeResponseParams(params);

    // Response format should be in developer message
    expect(messages[1].content).toContain("# Response Formats");
    expect(messages[1].content).toContain("## user_data");
    expect(messages[1].content).toContain("// User information");
  });

  it("should handle complex conversation with multiple inputs", () => {
    const params: ResponseCreateParamsBase = {
      input: [
        createMessageInput("user", "Hello"),
        createMessageInput("assistant", "Hi there!"),
        createMessageInput("user", "What can you do?"),
      ],
    };
    const messages = harmonizeResponseParams(params);

    expect(messages).toHaveLength(5); // System + 3 conversation messages + assistant prompt
    expect(messages[1].role).toBe("user");
    expect(messages[2].role).toBe("assistant");
    expect(messages[3].role).toBe("user");
  });

  it("should use custom knowledge cutoff", () => {
    const params: ResponseCreateParamsBase = {};
    const messages = harmonizeResponseParams(params, { knowledgeCutoff: "2025-01" });

    expect(messages[0].content).toContain("Knowledge cutoff: 2025-01");
  });

  it("should validate params", () => {
    const invalidParams = createInvalidParams({ temperature: 3 }) as ResponseCreateParamsBase;

    expect(() => harmonizeResponseParams(invalidParams)).toThrow("Temperature must be a number between 0 and 2");
  });

  it("should handle all features combined", () => {
    const params: ResponseCreateParamsBase = {
      model: "gpt-4o",
      instructions: "Be helpful and use tools wisely.",
      reasoning: { effort: "high" },
      tool_choice: createToolChoiceFunction("search"),
      tools: [
        webSearchTool,
        createFunctionTool({
          name: "search",
          description: "Search for information",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        }),
      ],
      text: createResponseTextConfig("search_results", { type: "array", items: { type: "object" } }),
      input: "Search for information about Harmony format",
    };

    const messages = harmonizeResponseParams(params);

    // Should have all message types
    expect(messages.length).toBeGreaterThanOrEqual(4);

    // System message checks
    const systemMsg = messages[0].content;
    expect(systemMsg).toContain("Reasoning: high");
    expect(systemMsg).toContain("## browser"); // Built-in tool
    expect(systemMsg).toContain("Calls to these tools must go to the commentary channel: 'functions'.");

    // Developer message checks
    const devMsg = messages[1].content;
    expect(devMsg).toContain("Be helpful and use tools wisely.");
    // Tool choice instruction should be included
    expect(devMsg).toContain("You must use the search function.");
    expect(devMsg).toContain("type search = (_: {");
    expect(devMsg).toContain("## search_results");

    // User message
    expect(messages[2].content).toContain("Search for information about Harmony format");

    // Assistant prompt
    expect(messages[messages.length - 1].content).toBe("<|start|>assistant");
  });
});

describe("extractChatCompletionParams integration", () => {
  it("should work with harmonizeResponseParams", () => {
    const params: ResponseCreateParamsBase = {
      model: "gpt-4o",
      temperature: 0.7,
      top_p: 0.9,
      max_output_tokens: 1000,
      stream: true,
      input: "Test",
    };

    // Extract params
    const chatParams = extractChatCompletionParams(params);

    // Get messages
    const messages = harmonizeResponseParams(params);

    // Verify extraction
    expect(chatParams).toEqual({
      model: "gpt-4o",
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 1000,
      stream: true,
    });

    // Messages should still work
    expect(messages.length).toBeGreaterThan(0);
  });
});
