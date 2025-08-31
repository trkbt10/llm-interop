/**
 * @file Adapts Claude API responses to OpenAI-compatible formats
 * Provides transformation layers to convert Anthropic Claude message responses into both
 * OpenAI Chat Completion format and OpenAI Responses API format, supporting both streaming
 * and non-streaming modes for seamless API compatibility.
 */
import type {
  Response as OpenAIResponse,
  ResponseStreamEvent,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseOutputText,
  ResponseFunctionToolCall,
  Tool,
} from "openai/resources/responses/responses";
import type { Message as ClaudeMessage, MessageStreamEvent } from "@anthropic-ai/sdk/resources/messages";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import {
  isClaudeContentDelta,
  isClaudeContentStart,
  isClaudeContentStop,
  isClaudeInputJsonDelta,
  isClaudeMessageDeltaWithStop,
  isClaudeMessageStop,
  isClaudeTextBlock,
  isClaudeToolUseBlock,
  isClaudeTextDelta,
  claudeHasUsage,
  claudeHasContentArray,
  isResponseOutputText,
  isResponseOutputMessage,
} from "../../../providers/claude/guards";
import { toOpenAICallIdFromClaude } from "../../conversation/id-conversion";

/**
 * Claude -> OpenAI Responses (non-stream)
 */
export function claudeToOpenAIResponse(claude: ClaudeMessage, requestModel: string): OpenAIResponse {
  const { text, items } = extractItemsFromClaude(claude);
  return buildResponse(items, requestModel, claude, text);
}

/**
 * Claude -> OpenAI ChatCompletion (non-stream)
 */
export function claudeToChatCompletion(claude: ClaudeMessage, requestModel: string): ChatCompletion {
  const { text, toolCalls } = extractChatContentFromClaude(claude);
  const created = Math.floor(Date.now() / 1000);
  const usage = claudeHasUsage(claude) ? claude.usage : { input_tokens: 0, output_tokens: 0 };

  return {
    id: `chatcmpl_${Date.now()}`,
    object: "chat.completion",
    created,
    model: requestModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text !== null && text !== undefined ? text : null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          refusal: null,
        },
        finish_reason: claude.stop_reason === "tool_use" ? "tool_calls" : "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: usage.input_tokens ?? 0,
      completion_tokens: usage.output_tokens ?? 0,
      total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    },
  };
}

/**
 * Claude SSE -> OpenAI ChatCompletion stream
 */
export async function* claudeToChatCompletionStream(
  events: AsyncIterable<MessageStreamEvent>,
  requestModel: string,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
  const id = `chatcmpl_${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const toolCallsInProgress = new Map<number, { id: string; name: string; args: string }>();

  for await (const ev of events) {
    if (isClaudeContentStart(ev)) {
      const index = ev.index ?? 0;
      const block = ev.content_block;
      if (isClaudeToolUseBlock(block)) {
        const openaiId = toOpenAICallIdFromClaude(block.id);
        toolCallsInProgress.set(index, { id: openaiId, name: block.name, args: "" });

        yield {
          id,
          object: "chat.completion.chunk",
          created,
          model: requestModel,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index,
                    id: openaiId,
                    type: "function",
                    function: {
                      name: block.name,
                      arguments: "",
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
      }
      continue;
    }

    if (isClaudeContentDelta(ev)) {
      const index = ev.index ?? 0;
      const d = ev.delta;
      if (isClaudeTextDelta(d) && d.text) {
        yield {
          id,
          object: "chat.completion.chunk",
          created,
          model: requestModel,
          choices: [
            {
              index: 0,
              delta: {
                content: d.text,
              },
              finish_reason: null,
            },
          ],
        };
        continue;
      }

      if (isClaudeInputJsonDelta(d)) {
        const t = toolCallsInProgress.get(index);
        if (t && d.partial_json) {
          t.args += d.partial_json;
          yield {
            id,
            object: "chat.completion.chunk",
            created,
            model: requestModel,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index,
                      function: {
                        arguments: d.partial_json,
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
        }
      }
      continue;
    }

    if (isClaudeMessageStop(ev)) {
      yield {
        id,
        object: "chat.completion.chunk",
        created,
        model: requestModel,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      };
      continue;
    }
  }
}

function extractChatContentFromClaude(msg: ClaudeMessage): {
  text: string;
  toolCalls: ChatCompletionMessageToolCall[];
} {
  const toolCalls: ChatCompletionMessageToolCall[] = [];
  const textParts: string[] = [];

  if (!claudeHasContentArray(msg)) {
    return { text: "", toolCalls };
  }

  for (const block of msg.content) {
    if (isClaudeTextBlock(block)) {
      textParts.push(block.text);
      continue;
    }

    if (isClaudeToolUseBlock(block)) {
      const args = JSON.stringify(block.input !== null && block.input !== undefined ? block.input : {});
      const openaiId = toOpenAICallIdFromClaude(block.id);
      toolCalls.push({
        id: openaiId,
        type: "function",
        function: {
          name: block.name,
          arguments: args,
        },
      });
    }
  }

  return { text: textParts.join(""), toolCalls };
}

type StreamProcessorState = {
  createdEmitted: boolean;
  sawText: boolean;
  sequence: number;
  textItemId?: string;
  accumulatedText: string;
  outputItems: ResponseOutputItem[];
  toolsMap: Map<number, { id: string; name: string; args: string }>;
};

function createInitialStreamState(): StreamProcessorState {
  return {
    createdEmitted: false,
    sawText: false,
    sequence: 0,
    textItemId: undefined,
    accumulatedText: "",
    outputItems: [],
    toolsMap: new Map(),
  };
}

function updateStateForCreated(state: StreamProcessorState): StreamProcessorState {
  return {
    ...state,
    createdEmitted: true,
    sequence: state.sequence + 1,
  };
}

function updateStateForToolStart(
  state: StreamProcessorState,
  index: number,
  openaiId: string,
  blockName: string,
  item: ResponseOutputItem,
): StreamProcessorState {
  const newToolsMap = new Map(state.toolsMap);
  newToolsMap.set(index, { id: openaiId, name: blockName, args: "" });

  return {
    ...state,
    toolsMap: newToolsMap,
    outputItems: [...state.outputItems, item],
    sequence: state.sequence + 1,
  };
}

function updateStateForTextDelta(
  state: StreamProcessorState,
  deltaText: string,
  newTextItemId?: string,
  messageItem?: ResponseOutputMessage,
): StreamProcessorState {
  const updates: Partial<StreamProcessorState> = {
    sawText: true,
    sequence: state.sequence + 1,
    accumulatedText: state.accumulatedText + deltaText,
  };

  if (newTextItemId) {
    updates.textItemId = newTextItemId;
  }

  if (messageItem) {
    updates.outputItems = [...state.outputItems, messageItem];
  }

  return { ...state, ...updates };
}

function updateStateForToolArgs(state: StreamProcessorState, index: number, partialJson: string): StreamProcessorState {
  const tool = state.toolsMap.get(index);
  if (!tool) {
    return { ...state, sequence: state.sequence + 1 };
  }

  const newToolsMap = new Map(state.toolsMap);
  newToolsMap.set(index, { ...tool, args: tool.args + partialJson });

  return {
    ...state,
    toolsMap: newToolsMap,
    sequence: state.sequence + 1,
  };
}

function updateStateForToolStop(
  state: StreamProcessorState,
  index: number,
  item: ResponseFunctionToolCall,
): StreamProcessorState {
  const itemIndex = state.outputItems.findIndex((i) => i.type === "function_call" && i.id === item.id);
  const newOutputItems = [...state.outputItems];
  if (itemIndex >= 0) {
    newOutputItems[itemIndex] = item;
  }

  return {
    ...state,
    outputItems: newOutputItems,
    sequence: state.sequence + 1,
  };
}

function updateStateForMessageStop(state: StreamProcessorState): StreamProcessorState {
  if (!state.sawText || !state.textItemId) {
    return { ...state, sequence: state.sequence + 1 };
  }

  const messageItemIndex = state.outputItems.findIndex((i) => isResponseOutputMessage(i));
  const newOutputItems = [...state.outputItems];

  if (messageItemIndex >= 0) {
    const messageItem = newOutputItems[messageItemIndex];
    if (isResponseOutputMessage(messageItem) && messageItem.content.length > 0) {
      const textContent = messageItem.content[0];
      if (isResponseOutputText(textContent)) {
        newOutputItems[messageItemIndex] = {
          ...messageItem,
          content: [{ ...textContent, text: state.accumulatedText }],
        };
      }
    }
  }

  return {
    ...state,
    outputItems: newOutputItems,
    sequence: state.sequence + 1,
  };
}

/**
 * Claude SSE -> OpenAI Responses stream
 */
export async function* claudeToOpenAIStream(
  events: AsyncIterable<MessageStreamEvent>,
  requestModel: string,
  requestTools?: Tool[],
): AsyncGenerator<ResponseStreamEvent, void, unknown> {
  const id = `resp_${Date.now()}`;
  const contentIndex = 0;
  const completedEmitted = false;
  const state = createInitialStreamState();

  for await (const ev of events) {
    if (!state.createdEmitted) {
      Object.assign(state, updateStateForCreated(state));
      const created: ResponseStreamEvent = {
        type: "response.created",
        response: buildEmptyResponse(id, requestModel, requestTools),
        sequence_number: state.sequence,
      } as const;
      yield created;
    }

    if (isClaudeContentStart(ev)) {
      const index = ev.index ?? 0;
      const block = ev.content_block;
      if (isClaudeToolUseBlock(block)) {
        const openaiId = toOpenAICallIdFromClaude(block.id);
        const item: ResponseOutputItem = buildFunctionCallItem(openaiId, block.name, undefined);
        Object.assign(state, updateStateForToolStart(state, index, openaiId, block.name, item));

        const added: ResponseStreamEvent = {
          type: "response.output_item.added",
          item,
          output_index: 0,
          sequence_number: state.sequence,
        } as const;
        yield added;
      }
      continue;
    }

    if (isClaudeContentDelta(ev)) {
      const index = ev.index ?? 0;
      const d = ev.delta;
      if (isClaudeTextDelta(d)) {
        if (d.text) {
          const currentTextItemId = state.textItemId !== undefined ? state.textItemId : genId("msg");
          const messageItem: ResponseOutputMessage | undefined = (() => {
            if (state.textItemId) {
              return undefined;
            }
            return {
              id: currentTextItemId,
              type: "message" as const,
              role: "assistant" as const,
              status: "completed" as const,
              content: [{ type: "output_text" as const, text: "", annotations: [] }],
            };
          })();

          Object.assign(state, updateStateForTextDelta(state, d.text, currentTextItemId, messageItem));

          const deltaEv: ResponseStreamEvent = {
            type: "response.output_text.delta",
            delta: d.text,
            item_id: state.textItemId!,
            output_index: 0,
            content_index: contentIndex,
            sequence_number: state.sequence,
            logprobs: [],
          } as const;
          yield deltaEv;
        }
        continue;
      }

      if (isClaudeInputJsonDelta(d)) {
        if (d.partial_json) {
          Object.assign(state, updateStateForToolArgs(state, index, d.partial_json));
          const t = state.toolsMap.get(index);
          if (t) {
            const argsDelta: ResponseStreamEvent = {
              type: "response.function_call_arguments.delta",
              item_id: t.id,
              output_index: 0,
              sequence_number: state.sequence,
              delta: d.partial_json,
            } as const;
            yield argsDelta;
          }
        }
      }
      continue;
    }

    if (isClaudeContentStop(ev)) {
      const index = ev.index ?? 0;
      const t = state.toolsMap.get(index);
      if (t) {
        const item = buildFunctionCallItem(t.id, t.name, t.args !== null && t.args !== undefined ? t.args : "");
        Object.assign(state, updateStateForToolStop(state, index, item));

        const done: ResponseStreamEvent = {
          type: "response.output_item.done",
          item,
          output_index: 0,
          sequence_number: state.sequence,
        } as const;
        yield done;
      }
      continue;
    }

    if (isClaudeMessageDeltaWithStop(ev)) {
      // Handle stop_reason in delta - don't emit text done here
      continue;
    }

    if (isClaudeMessageStop(ev)) {
      // Handle final message stop - emit text done first, then completed
      Object.assign(state, updateStateForMessageStop(state));

      if (state.sawText && state.textItemId) {
        const done: ResponseStreamEvent = {
          type: "response.output_text.done",
          item_id: state.textItemId,
          output_index: 0,
          content_index: contentIndex,
          logprobs: [],
          sequence_number: state.sequence,
          text: state.accumulatedText,
        } as const;
        yield done;
      }
    }
  }

  // Ensure completed event is always emitted at the end
  if (!completedEmitted) {
    const completed: ResponseStreamEvent = {
      type: "response.completed",
      response: buildCompletedResponse(id, requestModel, state.outputItems, requestTools),
      sequence_number: state.sequence + 1,
    } as const;
    yield completed;
  }
}

function extractItemsFromClaude(msg: ClaudeMessage): { text: string; items: ResponseOutputItem[] } {
  const items: ResponseOutputItem[] = [];
  const textParts: string[] = [];
  if (!claudeHasContentArray(msg)) {
    return { text: "", items };
  }
  for (const block of msg.content) {
    if (isClaudeTextBlock(block)) {
      textParts.push(block.text);
      continue;
    }

    if (isClaudeToolUseBlock(block)) {
      const args = JSON.stringify(block.input !== null && block.input !== undefined ? block.input : {});
      const openaiId = toOpenAICallIdFromClaude(block.id);
      items.push(buildFunctionCallItem(openaiId, block.name, args));
    }
  }
  if (textParts.length) {
    items.unshift(buildMessageItem(textParts.join("")));
  }
  return { text: textParts.join(""), items };
}

function buildResponse(
  items: ResponseOutputItem[],
  model: string,
  msg: ClaudeMessage | undefined,
  text: string,
): OpenAIResponse {
  const created = Math.floor(Date.now() / 1000);
  const usage = msg && claudeHasUsage(msg) ? msg.usage : { input_tokens: 0, output_tokens: 0 };
  const res: OpenAIResponse = {
    id: `resp_${Date.now()}`,
    object: "response",
    created_at: created,
    model: model,
    status: "completed",
    output_text: text,
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    output: items,
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    usage: {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  };
  return res;
}

function buildMessageItem(text: string): ResponseOutputMessage {
  const textPart: ResponseOutputText = { type: "output_text", text, annotations: [] };
  return {
    id: genId("msg"),
    type: "message",
    role: "assistant",
    status: "completed",
    content: [textPart],
  };
}

function buildFunctionCallItem(id: string, name: string, args?: string): ResponseFunctionToolCall {
  return {
    type: "function_call",
    id,
    call_id: id,
    name,
    arguments: args !== null && args !== undefined ? args : "",
  };
}

function buildEmptyResponse(id: string, model: string, tools?: Tool[]): OpenAIResponse {
  return {
    id,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model: model,
    status: "in_progress",
    output_text: "",
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    output: [],
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: tools !== null && tools !== undefined ? tools : [],
    top_p: null,
  };
}

function buildCompletedResponse(
  id: string,
  model: string,
  outputItems?: ResponseOutputItem[],
  tools?: Tool[],
): OpenAIResponse {
  // Calculate output_text from message items with text content
  const outputText = outputItems
    ?.filter(isResponseOutputMessage)
    .flatMap((msg) => msg.content)
    .filter(isResponseOutputText)
    .map((item) => item.text)
    .join("");
  const finalOutputText = outputText !== null && outputText !== undefined ? outputText : "";

  return {
    id,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model: model,
    status: "completed",
    output_text: finalOutputText,
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    output: outputItems !== null && outputItems !== undefined ? outputItems : [],
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: tools !== null && tools !== undefined ? tools : [],
    top_p: null,
  };
}

function genId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}
