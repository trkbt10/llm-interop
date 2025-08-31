/**
 * @file OpenAI → Gemini v1beta adapter (standalone)
 *
 * Recreates Gemini's v1beta surface (generateContent, streamGenerateContent, listModels)
 * on top of an OpenAI-compatible client.
 */
export { generateContent } from "./generate-content";
export { streamGenerateContent } from "./stream-generate-content";
export { listModels } from "./list-models";
export type { GeminiRequest, GeminiResponse, GeminiStreamChunk } from "./core/gemini-types";
export type { AdapterOptions, GenerateContentFn, StreamGenerateContentFn, ListModelsFn } from "./core/adapter-types";
import type { OpenAICompatibleClient } from "../openai-client-types";
import type { AdapterOptions, GenerateContentFn, StreamGenerateContentFn, ListModelsFn } from "./core/adapter-types";
import { generateContent as generateContentImpl } from "./generate-content";
import { streamGenerateContent as streamGenerateContentImpl } from "./stream-generate-content";
import { listModels as listModelsImpl } from "./list-models";

// Adapter factory: return functions pre-bound with client using a tiny binder
function bindClient<A extends unknown[], R>(
  fn: (client: OpenAICompatibleClient, ...args: A) => Promise<R>,
  client: OpenAICompatibleClient,
): (...args: A) => Promise<R> {
  return (...args: A) => fn(client, ...(args as A));
}

/** Build a standalone v1beta emulator on top of an OpenAI-compatible client */
export function buildOpenAItoGeminiV1BetaAdapter(opts: AdapterOptions): {
  generateContent: GenerateContentFn;
  streamGenerateContent: StreamGenerateContentFn;
  listModels: ListModelsFn;
} {
  const client: OpenAICompatibleClient = opts.client;
  return {
    generateContent: bindClient(generateContentImpl, client),
    streamGenerateContent: bindClient(streamGenerateContentImpl, client),
    listModels: () => listModelsImpl(client),
  };
}
