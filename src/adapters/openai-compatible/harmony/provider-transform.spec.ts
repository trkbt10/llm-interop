import type { ChatCompletion } from "openai/resources/chat/completions";
import type { Provider } from "../../../config/types";
import { buildOpenAIGenericAdapter } from "../factory";
import { describe, expect, it, vi, beforeEach } from "vitest";

const chatCreateMock = vi.fn();
const responsesCreateMock = vi.fn();
const modelsListMock = vi.fn();

class FakeOpenAI {
  constructor(_opts: unknown) {}

  chat = {
    completions: {
      create: chatCreateMock,
    },
  };

  responses = {
    create: responsesCreateMock,
  };

  models = {
    list: modelsListMock,
  };
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

    const capturedChatParams: unknown[] = [];

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

    chatCreateMock.mockImplementation(async (params) => {
      capturedChatParams.push(params);
      return chatCompletion;
    });

    responsesCreateMock.mockImplementation(() => {
      throw new Error("native response API should not be used in this test");
    });

    const client = buildOpenAIGenericAdapter(provider);

    const toolSchema = {
      type: "object",
      properties: {
        location: { type: "string" },
      },
      required: ["location"],
    } as const;

    const response = await client.responses.create({
      model: "gpt-oss-20b",
      input: "What's the weather in Tokyo?",
      tools: [
        {
          type: "function",
          name: "get_weather",
          description: "Get weather",
          parameters: toolSchema,
        },
      ],
      tool_choice: "auto",
    });

    expect(chatCreateMock).toHaveBeenCalledTimes(1);
    const [chatParams] = capturedChatParams as Array<{
      messages: Array<{ role: string; content: string }>;
      tools: unknown;
    }>;

    const systemMessage = chatParams.messages[0];
    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("# Valid channels");

    const developerMessage = chatParams.messages.find((m) => m.role === "system" && m.content.includes("# Tools"));
    expect(developerMessage?.content).toContain("namespace functions");

    const firstTool = Array.isArray(chatParams.tools) ? chatParams.tools[0] : undefined;
    expect(firstTool).toBeDefined();

    expect(response.output).toHaveLength(1);
    const [toolCall] = response.output as Array<{
      type: string;
      name: string;
      arguments: string;
    }>;
    expect(toolCall.type).toBe("function_call");
    expect(toolCall.name).toBe("get_weather");
    expect(toolCall.arguments).toContain("Tokyo");
  });
});
