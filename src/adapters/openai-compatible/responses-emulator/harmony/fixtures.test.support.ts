/**
 * @file Test fixtures for Harmony tests
 *
 * ⚠️ WARNING: This file is intended for TEST FILES ONLY!
 * DO NOT import this file in production code.
 *
 * This file contains test helpers and fixtures that provide properly typed test data.
 * The fixtures are designed to test edge cases and error conditions that should not
 * occur in production code.
 *
 * @module fixtures.test.support
 */

import type {
  Tool,
  FunctionTool,
  ResponseInputItem,
  ResponseTextConfig,
  ToolChoice,
  ResponseCreateParamsBase,
} from "./types";

// Tool fixtures
export const webSearchTool: Tool = {
  type: "web_search_preview_2025_03_11",
} as Tool;

export const codeInterpreterTool: Tool = {
  type: "code_interpreter",
} as Tool;

/**
 * Creates test function tool fixtures with customizable properties for Harmony testing.
 * Provides a factory for generating function tool test data with sensible defaults
 * while allowing specific properties to be overridden for testing edge cases.
 *
 * @param overrides - Optional property overrides for customizing the generated tool
 * @returns Function tool fixture ready for testing scenarios
 */
export function createFunctionTool(overrides?: Partial<FunctionTool>): FunctionTool {
  return {
    type: "function",
    name: "test_func",
    description: "Test function",
    parameters: {},
    strict: null,
    ...overrides,
  };
}

// Message input fixtures

/**
 * Creates test message input fixtures for Response API testing scenarios.
 * Provides a factory for generating message input test data with specified roles
 * and content formats, enabling comprehensive testing of message processing logic.
 *
 * @param role - Message role for testing different conversation participants
 * @param content - Message content in string or structured format
 * @returns Message input fixture ready for testing scenarios
 */
export function createMessageInput(
  role: "user" | "system" | "developer" | "assistant",
  content: string | Array<{ type: string; text?: string }>,
): ResponseInputItem {
  return {
    type: "message",
    role,
    content,
  } as ResponseInputItem;
}

/**
 * Creates test text input fixtures for Response API input testing.
 * Provides a factory for generating simple text input test data with proper
 * type structure, enabling testing of text input processing logic.
 *
 * @param text - Text content for the input fixture
 * @returns Text input fixture ready for testing scenarios
 */
export function createTextInput(text: string) {
  return {
    type: "input_text" as const,
    text,
  };
}

/**
 * Creates test function call input fixtures for Response API function testing.
 * Provides factory for generating function call test data to test function
 * invocation processing and validation logic.
 *
 * @param name - Function name for the call fixture
 * @returns Function call input fixture ready for testing
 */
export function createFunctionCallInput(name: string): ResponseInputItem {
  return {
    type: "function_call",
    name,
  } as ResponseInputItem;
}

/**
 * Creates test function call output fixtures for Response API function result testing.
 * Provides factory for generating function output test data to test function
 * result processing and response handling logic.
 *
 * @param output - Function output content for the fixture
 * @returns Function call output fixture ready for testing
 */
export function createFunctionCallOutput(output: string): ResponseInputItem {
  return {
    type: "function_call_output",
    output,
  } as ResponseInputItem;
}

// Response format fixtures

/**
 * Creates test response text configuration fixtures for structured output testing.
 * Provides factory for generating response format test data with JSON schemas
 * to test structured output processing and validation logic.
 *
 * @param name - Schema name for the response format
 * @param schema - JSON schema definition for response structure
 * @param description - Optional description for the response format
 * @returns Response text config fixture ready for testing
 */
export function createResponseTextConfig(
  name: string,
  schema: Record<string, unknown>,
  description?: string,
): ResponseTextConfig {
  return {
    response_format: {
      type: "json_schema",
      json_schema: {
        name,
        description,
        schema,
      },
    },
  } as ResponseTextConfig;
}

// Tool choice fixtures
export const toolChoiceNone: ToolChoice = "none";
export const toolChoiceAuto: ToolChoice = "auto";
export const toolChoiceRequired: ToolChoice = "required";

/**
 * Creates test tool choice function fixtures for tool selection testing.
 * Provides factory for generating tool choice test data to test specific
 * function tool selection and validation logic.
 *
 * @param name - Function name for the tool choice fixture
 * @returns Tool choice function fixture ready for testing
 */
export function createToolChoiceFunction(name: string): ToolChoice {
  return {
    type: "function",
    name,
  };
}

/**
 * Creates test tool choice custom fixtures for custom tool testing.
 * Provides factory for generating custom tool choice test data.
 *
 * @param name - Custom tool name for the choice fixture
 * @returns Tool choice custom fixture ready for testing
 */
export function createToolChoiceCustom(name: string): ToolChoice {
  return {
    type: "custom",
    name,
  };
}

/**
 * Creates test tool choice allowed fixtures for allowed tools testing.
 * Provides factory for generating allowed tools choice test data.
 *
 * @param mode - Tool selection mode for the choice fixture
 * @param tools - Optional array of allowed tools
 * @returns Tool choice allowed fixture ready for testing
 */
export function createToolChoiceAllowed(
  mode: "auto" | "required",
  tools?: Array<{ type: string; name?: string }>,
): ToolChoice {
  return {
    type: "allowed_tools",
    mode,
    tools: tools ? tools : [],
  };
}

// Invalid params for testing validation

/**
 * Creates invalid parameter fixtures for error testing scenarios.
 * Provides factory for generating malformed parameters to test validation.
 *
 * @param overrides - Parameter overrides that create invalid state
 * @returns Invalid parameter fixture for validation testing
 */
export function createInvalidParams(overrides: Partial<ResponseCreateParamsBase>): unknown {
  return overrides;
}

// Create invalid function tool for testing

/**
 * Create an invalid function tool object for negative tests.
 */
export function createInvalidFunctionTool(func: Record<string, unknown>): unknown {
  return { function: func };
}

// Content parts

/**
 * Create a minimal text content part for tests.
 */
export function createTextContentPart(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

/**
 * Create a minimal image content part for tests.
 */
export function createImageContentPart(url: string): { type: "image"; url: string } {
  return { type: "image", url };
}
