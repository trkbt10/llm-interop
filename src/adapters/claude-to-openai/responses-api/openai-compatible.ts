/**
 * @file OpenAI-compatible client implementation for Claude provider
 * Creates an OpenAI-compatible interface for Anthropic Claude, implementing both Chat Completions
 * and Responses APIs by wrapping Claude's message API and transforming requests/responses to
 * maintain full compatibility with OpenAI client expectations.
 */
import type {
  Response as OpenAIResponse,
  ResponseCreateParams,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses";
import type { Provider } from "../../../config/types";
import Anthropic from "@anthropic-ai/sdk";
import type { OpenAICompatibleClient } from "../../openai-client-types";
import { selectApiKey } from "../../../config/select-api-key";
import type { ResponseFunctionToolCallOutputItem } from "openai/resources/responses/responses";
import { isOpenAIResponsesFunctionTool } from "../../../providers/openai/responses-guards";
import type {
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from "openai/resources/chat/completions";
import type { FunctionDefinition, FunctionParameters } from "openai/resources/shared";
import {
  claudeToOpenAIResponse,
  claudeToOpenAIStream,
  claudeToChatCompletion,
  claudeToChatCompletionStream,
} from "../chat-completion/openai-response-adapter";
import { chatCompletionToClaudeLocal } from "../chat-completion/request-converter";
// Conversation state updates are handled by the HTTP response processor
import { resolveModelForProvider } from "../../../model/mapper";
import { convertOpenAIChatToolToResponsesTool } from "../../shared/openai-tool-converters";

function addInputMessages(
  messages: ChatCompletionCreateParams["messages"],
  input: ResponseCreateParams["input"],
): void {
  if (!input) {
    return;
  }

  if (typeof input === "string") {
    messages.push({ role: "user", content: input });
    return;
  }

  // Convert ResponseInput array to ChatCompletionMessageParam[]
  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== "object") {
        continue;
      }

      // Convert function_call_output to tool message
      if (item.type === "function_call_output") {
        const toolOutput = item as ResponseFunctionToolCallOutputItem;
        messages.push({
          role: "tool",
          tool_call_id: toolOutput.call_id,
          content: toolOutput.output,
        });
        continue;
      }

      // Convert message-like objects with role and content
      if ("role" in item && "content" in item) {
        const role = item.role as "user" | "assistant" | "system";
        const content = item.content;

        // For assistant messages with tool_calls, preserve them
        if (role === "assistant" && "tool_calls" in item) {
          if (item.tool_calls) {
            messages.push({
              role: "assistant",
              content: typeof content === "string" ? content : "",
              tool_calls: item.tool_calls,
            } as ChatCompletionCreateParams["messages"][0]);
          } else {
            messages.push({
              role,
              content: typeof content === "string" ? content : "",
            });
          }
        } else {
          // Regular message without tool calls
          messages.push({
            role,
            content: typeof content === "string" ? content : "",
          });
        }
        continue;
      }
    }
  }
}

function convertToolsForChat(tools: Tool[] | undefined): ChatCompletionTool[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) {
    return undefined;
  }
  const out: ChatCompletionTool[] = [];
  for (const t of tools) {
    if (isOpenAIResponsesFunctionTool(t)) {
      const fn: FunctionDefinition = {
        name: t.name,
        description: t.description ?? "",
      };
      if (t.parameters) {
        fn.parameters = t.parameters as FunctionParameters;
      }
      if (t.strict !== undefined && t.strict !== null) {
        fn.strict = t.strict;
      }
      out.push({ type: "function", function: fn });
    }
  }
  return out.length ? out : undefined;
}

function convertToolChoiceForChat(toolChoice: unknown): ChatCompletionToolChoiceOption | undefined {
  if (toolChoice == null) {
    return undefined;
  }
  if (typeof toolChoice === "string") {
    if (toolChoice === "auto" || toolChoice === "none" || toolChoice === "required") {
      return toolChoice;
    }
    return "auto";
  }
  if (typeof toolChoice === "object" && toolChoice !== null) {
    const obj = toolChoice as Record<string, unknown>;
    if (obj.type === "function" && typeof obj.name === "string") {
      return { type: "function", function: { name: obj.name } };
    }
  }
  return "auto";
}

function buildChatParams(params: ResponseCreateParams): ChatCompletionCreateParams {
  const messages: ChatCompletionCreateParams["messages"] = [];

  if (params.instructions) {
    messages.push({ role: "system", content: params.instructions });
  }

  addInputMessages(messages, params.input);

  const chatParams: ChatCompletionCreateParams = {
    model: params.model ? params.model : process.env.ANTHROPIC_MODEL ? process.env.ANTHROPIC_MODEL : "",
    messages,
    stream: !!params.stream,
  };

  if (params.max_output_tokens != null) {
    chatParams.max_tokens = params.max_output_tokens;
  }
  // Temperature and top_p disabled for all models
  // if (params.temperature != null) chatParams.temperature = params.temperature;
  // if (params.top_p != null) chatParams.top_p = params.top_p;
  if (params.tools) {
    const mapped = convertToolsForChat(params.tools);
    if (mapped) {
      chatParams.tools = mapped;
    }
  }
  if (params.tool_choice) {
    const choice = convertToolChoiceForChat(params.tool_choice);
    if (choice) {
      chatParams.tool_choice = choice;
    }
  }

  return chatParams;
}

/**
 * Creates a complete OpenAI-compatible client interface that wraps Anthropic Claude API functionality.
 * Provides full OpenAI API compatibility by implementing Chat Completions and Response APIs
 * on top of Claude's message endpoint. Essential for enabling drop-in replacement of OpenAI
 * clients with Claude backend while maintaining complete API compatibility and proper
 * request/response transformation.
 *
 * @param provider - Claude provider configuration with API credentials and settings
 * @param modelHint - Optional model identifier for optimizing client initialization
 * @returns Complete OpenAI-compatible client with Chat Completions, Responses, and Models APIs
 */
export function buildOpenAICompatibleClientForClaude(provider: Provider, modelHint?: string): OpenAICompatibleClient {
  const apiKey = selectApiKey(provider, modelHint);
  if (!apiKey) {
    throw new Error("Missing Anthropic API key (configure provider.apiKey or api.keyByModelPrefix)");
  }
  const anthropic = new Anthropic({ apiKey, baseURL: provider.baseURL });

  // No longer using per-conversation ID manager; conversions are deterministic

  // chat.completions.create overloads
  function chatCompletionsCreate(
    params: ChatCompletionCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<ChatCompletion>;
  function chatCompletionsCreate(
    params: ChatCompletionCreateParamsStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<AsyncIterable<ChatCompletionChunk>>;
  function chatCompletionsCreate(
    params: ChatCompletionCreateParams,
    options?: { signal?: AbortSignal },
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>;
  async function chatCompletionsCreate(
    params: ChatCompletionCreateParams,
    options?: { signal?: AbortSignal },
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
    // Resolve model using live models list (type-safe, provider-driven)
    const resolvedModel = await resolveModelForProvider({
      provider,
      sourceModel: params.model,
      modelHint,
    });
    const claudeReq = chatCompletionToClaudeLocal({ ...params, model: resolvedModel });

    if (params.stream) {
      const streamAny = await anthropic.messages.create(
        { ...claudeReq, stream: true },
        { signal: options?.signal },
      );
      return claudeToChatCompletionStream(streamAny, resolvedModel);
    }

    const claudeResp = await anthropic.messages.create(
      { ...claudeReq, stream: false },
      { signal: options?.signal },
    );
    return claudeToChatCompletion(claudeResp, resolvedModel);
  }

  // responses.create overloads
  function responsesCreate(
    params: ResponseCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<OpenAIResponse>;
  function responsesCreate(
    params: ResponseCreateParamsStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<AsyncIterable<ResponseStreamEvent>>;
  function responsesCreate(
    params: ResponseCreateParams,
    options?: { signal?: AbortSignal },
  ): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>>;
  async function responsesCreate(
    params: ResponseCreateParams,
    options?: { signal?: AbortSignal },
  ): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>> {
    const chatParams = buildChatParams(params);
    // Resolve model using live models list (type-safe, provider-driven)
    chatParams.model = await resolveModelForProvider({
      provider,
      sourceModel: chatParams.model,
      modelHint,
    });
    const claudeReq = chatCompletionToClaudeLocal(chatParams);

    if (chatParams.stream) {
      const streamAny = await anthropic.messages.create(
        { ...claudeReq, stream: true },
        { signal: options?.signal },
      );
      const openaiTools = chatParams.tools
        ?.map(convertOpenAIChatToolToResponsesTool)
        .filter((t): t is Tool => t !== null);
      return claudeToOpenAIStream(streamAny, chatParams.model, openaiTools);
    }

    const claudeResp = await anthropic.messages.create(
      { ...claudeReq, stream: false },
      { signal: options?.signal },
    );
    const response = claudeToOpenAIResponse(claudeResp, chatParams.model);
    return response;
  }

  return {
    chat: {
      completions: {
        create: chatCompletionsCreate,
      },
    },
    responses: {
      create: responsesCreate,
    },
    models: {
      async list() {
        const models = await anthropic.models.list();
        const data = models.data.map((m) => ({
          id: m.id,
          object: "model" as const,
          created: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
          owned_by: "anthropic",
        }));
        return { data };
      },
    },
  };
}
