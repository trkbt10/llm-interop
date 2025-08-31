/**
 * @file Types for OpenAI → Gemini v1beta adapter
 */
import type { OpenAICompatibleClient } from "../../openai-client-types";
import type { GeminiRequest, GeminiResponse } from "./gemini-types";

export type AdapterOptions = { client: OpenAICompatibleClient };

export type GenerateContentFn = (
  model: string,
  body: GeminiRequest,
  options?: { signal?: AbortSignal },
) => Promise<GeminiResponse>;

export type StreamGenerateContentFn = (
  model: string,
  body: GeminiRequest,
  options?: { signal?: AbortSignal },
) => Promise<AsyncIterable<unknown>>;

export type ListModelsFn = () => Promise<{
  models: Array<{
    name: string;
    displayName: string;
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportedGenerationMethods: string[];
  }>;
}>;
