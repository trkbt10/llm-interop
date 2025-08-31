/**
 * @file OpenAI Responses API adapter implementation
 */
import OpenAI from "openai";
import type {
  Response as OpenAIResponse,
  ResponseCreateParams,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import { convertChatCompletionToResponse } from "./chat-to-response-converter";
import { createStreamHandlerState, handleStream } from "./stream-handler";
import { convertResponseInputToMessages } from "./input-converter";
import { convertToolsForChat, convertToolChoiceForChat } from "./tool-converter";
import { harmonizeResponseParams, type HarmonizerOptions } from "../harmony/response-to-chat";
import {
  convertHarmonyToResponses,
  createHarmonyToResponsesStream,
} from "../harmony/to-responses-response";

/**
 * ResponsesAPI class that converts between Responses API and Chat Completions API
 */
// eslint-disable-next-line no-restricted-syntax -- API adapter class provides necessary encapsulation
export class ResponsesAPI {
  constructor(
    private openai: OpenAI,
    private options: { useHarmony?: boolean; harmonizer?: HarmonizerOptions } = {},
  ) {}

  /**
   * Creates a response using OpenAI's chat completions API
   * while mimicking the Responses API interface
   */
  async create(params: ResponseCreateParamsNonStreaming): Promise<OpenAIResponse>;
  async create(params: ResponseCreateParamsStreaming): Promise<AsyncIterable<ResponseStreamEvent>>;
  async create(params: ResponseCreateParams): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>> {
    // Convert ResponseInput to chat messages
    const messages = this.convertInputToMessages(params);

    // Build chat completion parameters
    const chatParams = this.buildChatParams(params, messages);

    if (params.stream) {
      return this.handleStreamingResponse(chatParams);
    }

    return this.handleNonStreamingResponse(chatParams);
  }

  private convertInputToMessages(params: ResponseCreateParams): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (this.options.useHarmony) {
      // Harmony: synthesize entire prompt from Response params
      return harmonizeResponseParams(params, this.options.harmonizer ?? {});
    }

    // Add system/developer instructions if provided
    if (params.instructions) {
      messages.push({
        role: "system",
        content: params.instructions,
      });
    }

    // Convert input to messages
    if (params.input) {
      if (typeof params.input === "string") {
        messages.push({
          role: "user",
          content: params.input,
        });
        return messages;
      }

      // Convert ResponseInput to messages
      const convertedMessages = convertResponseInputToMessages(params.input);
      messages.push(...convertedMessages);
    }

    return messages;
  }

  private buildChatParams(
    params: ResponseCreateParams,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): OpenAI.Chat.ChatCompletionCreateParams {
    const model = params.model ?? "gpt-4o";
    const chatParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      stream: params.stream ?? false,
    };

    // Map optional parameters
    if (params.max_output_tokens !== undefined && params.max_output_tokens !== null) {
      chatParams.max_tokens = params.max_output_tokens;
    }

    // Temperature and top_p are disabled for all models
    // if (params.temperature !== undefined && params.temperature !== null) {
    //   chatParams.temperature = params.temperature;
    // }

    // if (params.top_p !== undefined && params.top_p !== null) {
    //   chatParams.top_p = params.top_p;
    // }

    if (params.tools) {
      chatParams.tools = convertToolsForChat(params.tools);
    }

    if (params.tool_choice) {
      chatParams.tool_choice = convertToolChoiceForChat(params.tool_choice);
    }

    if (params.metadata) {
      chatParams.metadata = params.metadata;
    }

    // Note: The Responses API doesn't have a direct response_format parameter
    // If you need structured outputs, you might need to handle this differently
    // based on your specific requirements

    return chatParams;
  }

  private isO1Model(model: string): boolean {
    if (model.startsWith("o1")) {
      return true;
    }
    if (model.startsWith("o3")) {
      return true;
    }
    if (model.startsWith("o4")) {
      return true;
    }
    return false;
  }

  private async handleNonStreamingResponse(
    chatParams: OpenAI.Chat.ChatCompletionCreateParams,
  ): Promise<OpenAIResponse> {
    const completion = await this.openai.chat.completions.create({
      ...chatParams,
      stream: false,
    });

    if (this.options.useHarmony) {
      // Convert Harmony-styled output to a final Responses object via events
      const msg = completion.choices?.[0]?.message;
      const contentStr: string = typeof msg?.content === "string" ? msg.content : String(msg?.content ?? "");
      const events = await convertHarmonyToResponses(
        { role: "assistant", content: contentStr },
        { requestId: completion.id, model: completion.model, stream: false },
      );
      // Find response.completed
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const ev = events[i];
        if (ev.type === "response.completed") {
          return ev.response;
        }
      }
      // Fallback to generic converter if no completed event found
      return convertChatCompletionToResponse(completion);
    }

    return convertChatCompletionToResponse(completion);
  }

  private async handleStreamingResponse(
    chatParams: OpenAI.Chat.ChatCompletionCreateParams,
  ): Promise<AsyncIterable<ResponseStreamEvent>> {
    const stream = await this.openai.chat.completions.create({
      ...chatParams,
      stream: true,
    });

    if (this.options.useHarmony) {
      // Map ChatCompletionChunk -> harmony text chunks, then convert to Response events
      async function* textChunks(): AsyncGenerator<string, void, unknown> {
        for await (const chunk of stream) {
          const delta = (chunk as OpenAI.Chat.ChatCompletionChunk).choices?.[0]?.delta;
          const slice = typeof delta?.content === "string" ? delta.content : "";
          if (slice) {
            yield slice;
          }
        }
      }
      return createHarmonyToResponsesStream(textChunks(), {});
    }

    const handlerState = createStreamHandlerState();
    // Return the async generator that yields ResponseStreamEvent objects
    return handleStream(handlerState, stream);
  }
}
