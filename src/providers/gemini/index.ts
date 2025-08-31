/**
 * @file Public entry for Gemini provider helpers.
 */

// Factory
export { buildGeminiAdapter } from "./adapter-factory";

// Guards (explicit exports)
export {
  isGeminiResponse,
  ensureGeminiStream,
  isGeminiTextPart,
  isGeminiFunctionCallPart,
  isGeminiFunctionResponsePart,
  getFirstCandidate,
  getCandidateParts,
  hasGeminiTextProperty,
} from "./guards";

// Client (explicit exports)
export type {
  GeminiClientOptions,
  GeminiPart,
  GeminiContent,
  GenerateContentRequest,
  GenerateContentResponse,
  StreamedPart,
  GeminiModel,
  ListModelsResponse,
  CountTokensRequest,
  CountTokensResponse,
  EmbedContentRequest,
  EmbedContentResponse,
  BatchEmbedContentsRequest,
  BatchEmbedContentsResponse,
} from "./client/fetch-client";
export { GeminiFetchClient } from "./client/fetch-client";
