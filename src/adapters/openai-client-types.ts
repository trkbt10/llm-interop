/**
 * @file Type definitions and interfaces for OpenAI client functionality
 */
import type {
  Response as OpenAIResponse,
  ResponseCreateParams,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";

// Shared helper
type RequestOptions = {
  signal?: AbortSignal;
};

// Reusable overload interfaces
export type ChatCompletionsCreateFn = {
  (params: ChatCompletionCreateParamsNonStreaming, options?: RequestOptions): Promise<ChatCompletion>;
  (params: ChatCompletionCreateParamsStreaming, options?: RequestOptions): Promise<AsyncIterable<ChatCompletionChunk>>;
  (
    params: ChatCompletionCreateParams,
    options?: RequestOptions,
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>;
};

export type ResponsesCreateFn = {
  (params: ResponseCreateParamsNonStreaming, options?: RequestOptions): Promise<OpenAIResponse>;
  (params: ResponseCreateParamsStreaming, options?: RequestOptions): Promise<AsyncIterable<ResponseStreamEvent>>;
  (
    params: ResponseCreateParams,
    options?: RequestOptions,
  ): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>>;
};

export type ResponsesStreamFn = (
  params: ResponseCreateParamsStreaming,
  options?: RequestOptions,
) => Promise<AsyncIterable<ResponseStreamEvent>>;

// Factory helpers (centralize type assertions for overload support)

/**
 * Type guard to validate ChatCompletionCreateParams structure.
 * @param params - Parameters to validate
 * @returns True if parameters are valid ChatCompletionCreateParams
 */
function isChatCompletionParams(params: unknown): params is ChatCompletionCreateParams {
  if (typeof params !== "object") {
    return false;
  }
  if (params === null) {
    return false;
  }
  return "model" in params;
}

/**
 * Type guard to validate ResponseCreateParams structure.
 * @param params - Parameters to validate
 * @returns True if parameters are valid ResponseCreateParams
 */
function isResponseParams(params: unknown): params is ResponseCreateParams {
  if (typeof params !== "object") {
    return false;
  }
  if (params === null) {
    return false;
  }
  return "model" in params;
}

/**
 * Creates type-safe Chat Completion function implementations with proper overload support.
 * Provides a factory for generating Chat Completion functions that correctly handle both
 * streaming and non-streaming requests with proper TypeScript type inference. Essential
 * for maintaining type safety across different OpenAI client implementations.
 *
 * @param impl - Implementation function handling Chat Completion requests
 * @returns Type-safe Chat Completion function with proper overloads
 */
export function defineChatCompletionsCreate(
  impl: (
    params: ChatCompletionCreateParams,
    options?: RequestOptions,
  ) => Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>,
): ChatCompletionsCreateFn {
  function create(
    params: ChatCompletionCreateParamsNonStreaming,
    options?: RequestOptions,
  ): Promise<ChatCompletion>;
  function create(
    params: ChatCompletionCreateParamsStreaming,
    options?: RequestOptions,
  ): Promise<AsyncIterable<ChatCompletionChunk>>;
  function create(
    params: ChatCompletionCreateParams,
    options?: RequestOptions,
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>;
  async function create(
    params: ChatCompletionCreateParams,
    options?: RequestOptions,
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
    if (!isChatCompletionParams(params)) {
      throw new Error("Invalid ChatCompletionCreateParams");
    }
    return impl(params, options);
  }
  return create;
}

/**
 * Creates type-safe Response API function implementations with proper overload support.
 * Provides a factory for generating Response API functions that correctly handle both
 * streaming and non-streaming requests with accurate TypeScript type inference. Critical
 * for ensuring type safety across different Response API client implementations.
 *
 * @param impl - Implementation function handling Response API requests
 * @returns Type-safe Response API function with proper overloads
 */
export function defineResponsesCreate(
  impl: (
    params: ResponseCreateParams,
    options?: RequestOptions,
  ) => Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>>,
): ResponsesCreateFn {
  function create(
    params: ResponseCreateParamsNonStreaming,
    options?: RequestOptions,
  ): Promise<OpenAIResponse>;
  function create(
    params: ResponseCreateParamsStreaming,
    options?: RequestOptions,
  ): Promise<AsyncIterable<ResponseStreamEvent>>;
  function create(
    params: ResponseCreateParams,
    options?: RequestOptions,
  ): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>>;
  async function create(
    params: ResponseCreateParams,
    options?: RequestOptions,
  ): Promise<OpenAIResponse | AsyncIterable<ResponseStreamEvent>> {
    if (!isResponseParams(params)) {
      throw new Error("Invalid ResponseCreateParams");
    }
    return impl(params, options);
  }
  return create;
}

export type OpenAICompatibleClient = {
  chat: {
    completions: {
      create: ChatCompletionsCreateFn;
    };
  };
  responses: {
    create: ResponsesCreateFn;
    stream?: ResponsesStreamFn;
  };
  models: {
    list(): Promise<{ data: Array<{ id: string; created: number; object: string; owned_by: string }> }>;
  };
  setToolNameResolver?(resolver: (callId: string) => string | undefined): void;
};

export type {
  OpenAIResponse,
  ResponseCreateParams,
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
};
