/**
 * @file Mock Chat Completion adapter for Gemini provider
 * Provides placeholder implementations of OpenAI Chat Completion API for Gemini provider,
 * generating mock responses and streaming chunks with basic echo functionality and tool call
 * simulation to support development and testing scenarios.
 */
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionCreateParams,
} from "openai/resources/chat/completions";
import type { ChatCompletionMessage, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import { isFunctionToolChoice } from "../../../providers/openai/chat-guards";
import { generateId } from "../../conversation/id-conversion";

function buildAssistantText(messages: ChatCompletionMessageParam[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const txt = typeof lastUser?.content === "string" ? lastUser.content : "";
  return txt ? `Echo: ${txt}` : "Echo: (no input)";
}

/**
 * Generates mock OpenAI Chat Completion responses for Gemini provider development.
 * Provides placeholder functionality when Gemini's actual chat completion implementation
 * is unavailable, enabling continued development and testing of integration workflows.
 * Simulates tool calls and text responses based on OpenAI Chat Completion patterns.
 *
 * @param params - OpenAI Chat Completion parameters for mock response generation
 * @returns Mock ChatCompletion response with simulated content and metadata
 */
export function geminiToChatCompletion(params: ChatCompletionCreateParams): ChatCompletion {
  const id = generateId("chatcmpl");
  const text = buildAssistantText(params.messages);
  const created = Math.floor(Date.now() / 1000);

  const toolChoiceInfo = (() => {
    const toolChoice = params.tool_choice;
    if (isFunctionToolChoice(toolChoice)) {
      return {
        toolForced: true,
        toolName: toolChoice.function?.name ? toolChoice.function.name : "",
      };
    }
    return {
      toolForced: false,
      toolName: "",
    };
  })();

  const createMessage = (): ChatCompletionMessage => {
    if (toolChoiceInfo.toolForced) {
      return {
        role: "assistant",
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: generateId("call"),
            type: "function",
            function: { name: toolChoiceInfo.toolName, arguments: JSON.stringify({ input: "test" }) },
          } as ChatCompletionMessageToolCall,
        ],
      };
    }
    return {
      role: "assistant",
      content: text,
      refusal: null,
    };
  };
  const message = createMessage();

  return {
    id,
    object: "chat.completion",
    created,
    model: params.model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  } as ChatCompletion;
}

/**
 * Generates mock streaming Chat Completion chunks for Gemini provider testing.
 * Simulates real-time response streaming behavior when Gemini's actual streaming
 * implementation is not available, enabling development of streaming UI components
 * and testing of streaming response handling logic.
 *
 * @param params - OpenAI Chat Completion parameters for mock stream generation
 * @yields Mock ChatCompletionChunk objects simulating progressive response generation
 */
export async function* geminiToChatCompletionStream(
  params: ChatCompletionCreateParams,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  const id = generateId("chatcmpl");
  const created = Math.floor(Date.now() / 1000);
  const toolChoiceInfo = (() => {
    const toolChoice = params.tool_choice;
    if (isFunctionToolChoice(toolChoice)) {
      return {
        toolForced: true,
        toolName: toolChoice.function?.name ? toolChoice.function.name : "",
      };
    }
    return {
      toolForced: false,
      toolName: "",
    };
  })();

  if (toolChoiceInfo.toolForced) {
    // Emit tool_call deltas
    const callId = generateId("call");
    const firstDelta: ChatCompletionChunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: params.model,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: null,
            tool_calls: [
              { index: 0, id: callId, type: "function", function: { name: toolChoiceInfo.toolName, arguments: "" } },
            ],
          },
          finish_reason: null,
        },
      ],
    };
    yield firstDelta;
    const secondDelta: ChatCompletionChunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: params.model,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, id: callId, type: "function", function: { arguments: JSON.stringify({ input: "test" }) } },
            ],
          },
          finish_reason: null,
        },
      ],
    };
    yield secondDelta;
    const finalDelta: ChatCompletionChunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: params.model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
    yield finalDelta;
    return;
  }

  const text = buildAssistantText(params.messages);
  const chunks = [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))];
  // First chunk with role
  const first: ChatCompletionChunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model: params.model,
    choices: [{ index: 0, delta: { role: "assistant", content: chunks[0] }, finish_reason: null }],
  };
  yield first;
  // Second chunk
  if (chunks[1]) {
    const second: ChatCompletionChunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: params.model,
      choices: [{ index: 0, delta: { content: chunks[1] }, finish_reason: null }],
    };
    yield second;
  }
  // Done
  const done: ChatCompletionChunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model: params.model,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };
  yield done;
}
