/**
 * @file Integration test for the Harmony request/response adapter using lightweight Vitest doubles.
 */
/* eslint-disable no-restricted-imports -- The test harness relies on explicit Vitest helpers for type-safe mocks. */
/* eslint-disable no-restricted-properties -- vi.* is used to observe adapter interactions without external side effects. */
/* eslint-disable no-restricted-syntax -- Mocked constructs emulate the OpenAI SDK shape for deterministic testing. */
import type { ChatCompletion, ChatCompletionCreateParams } from "openai/resources/chat/completions";
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses";
import type { Provider } from "../../../config/types";
import { buildOpenAIGenericAdapter } from "../factory";
import { describe, expect, it, vi, beforeEach } from "vitest";

const chatCreateMock = vi.fn();
const responsesCreateMock = vi.fn();
const modelsListMock = vi.fn();

function FakeOpenAI(this: Record<string, unknown>): void {
  Object.assign(this, {
    chat: {
      completions: {
        create: chatCreateMock,
      },
    },
    responses: {
      create: responsesCreateMock,
    },
    models: {
      list: modelsListMock,
    },
  });
}

vi.mock("openai", () => ({
  __esModule: true,
  default: FakeOpenAI,
  OpenAI: FakeOpenAI,
}));

describe("OpenAI provider with Harmony transform", () => {
  beforeEach(() => {
    chatCreateMock.mockReset();
    responsesCreateMock.mockReset();
    modelsListMock.mockReset();
  });

  it("converts Responses params to Harmony chat payload and back including tool calls", async () => {
    const provider: Provider = {
      type: "openai",
      baseURL: "https://example.invalid/v1",
      apiKey: "test-key",
      openaiCompat: {
        transformHarmony: true,
        emulateResponsesWithChat: true,
        preferResponsesAPI: false,
      },
    };

    type CapturedChatParams = {
      messages: ChatCompletionCreateParams["messages"];
      tools: ChatCompletionCreateParams["tools"];
    };

    const capturedChatParams: CapturedChatParams[] = [];

    const chatCompletion: ChatCompletion = {
      id: "chatcmpl_test",
      object: "chat.completion",
      created: 0,
      model: "gpt-oss-20b",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
            refusal: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: "{\"location\":\"Tokyo\"}",
                },
              },
            ],
          },
          finish_reason: "tool_calls",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    chatCreateMock.mockImplementation(async (params: ChatCompletionCreateParams) => {
      capturedChatParams.push({ messages: params.messages, tools: params.tools });
      return chatCompletion;
    });

    responsesCreateMock.mockImplementation(() => {
      throw new Error("native response API should not be used in this test");
    });

    const client = buildOpenAIGenericAdapter(provider);

    type FunctionTool = Extract<NonNullable<ChatCompletionCreateParams["tools"]>[number], { type: "function" }>;
    const toolSchema: FunctionTool["function"]["parameters"] = {
      type: "object",
      properties: {
        location: { type: "string" },
      },
      required: ["location"],
    };

    const response = await client.responses.create({
      model: "gpt-oss-20b",
      input: "What's the weather in Tokyo?",
      tools: [
        {
          type: "function",
          name: "get_weather",
          description: "Get weather",
          parameters: toolSchema,
          strict: true,
        },
      ],
      tool_choice: "auto",
    });

    expect(chatCreateMock).toHaveBeenCalledTimes(1);
    const [chatParams] = capturedChatParams;

    const systemMessage = chatParams.messages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("# Valid channels");

    const developerMessage = chatParams.messages.find((message) => {
      if (message.role !== "system") {
        return false;
      }
      if (typeof message.content !== "string") {
        return false;
      }
      return message.content.includes("# Tools");
    });

    if (!developerMessage || typeof developerMessage.content !== "string") {
      throw new Error("Expected a developer system message describing tools");
    }

    expect(developerMessage.content).toContain("namespace functions");

    if (!Array.isArray(chatParams.tools) || chatParams.tools.length === 0) {
      throw new Error("Expected Harmony conversion to define at least one tool");
    }
    const [firstTool] = chatParams.tools;
    expect(firstTool).toBeDefined();

    expect(response.output).toHaveLength(1);
    const toolCall = findFunctionToolCall(response.output);

    if (!toolCall) {
      throw new Error("Expected a function tool call in the response output");
    }

    expect(toolCall.type).toBe("function_call");
    expect(toolCall.name).toBe("get_weather");
    expect(toolCall.arguments).toContain("Tokyo");
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResponseFunctionToolCall(value: unknown): value is ResponseFunctionToolCall {
  if (!isRecord(value)) {
    return false;
  }
  const { type, name, arguments: args } = value;
  return type === "function_call" && typeof name === "string" && typeof args === "string" && typeof value.call_id === "string";
}

function findFunctionToolCall(output: unknown): ResponseFunctionToolCall | undefined {
  if (!Array.isArray(output)) {
    return undefined;
  }
  return output.find(isResponseFunctionToolCall);
}
