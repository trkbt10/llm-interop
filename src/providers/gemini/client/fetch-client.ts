/**
 * @file Fetch-based Google Gemini API client implementation
 * Provides a lightweight HTTP client for Google's Generative Language API v1beta endpoints,
 * supporting content generation, streaming responses, token counting, and embeddings using
 * standard Web APIs without external dependencies for Gemini provider integration.
 */
import { httpErrorFromResponse } from "../errors/http-error";
import { yieldSSEParts, streamText, yieldInnerJsonBlocks } from "./stream-in-block";

/**
 * Creates a Response-like object for error handling
 */
const createResponseLike = (res: globalThis.Response, text: string): Response => {
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    url: res.url,
    text: async () => text,
  } as Response;
};

export type GeminiClientOptions = {
  apiKey: string;
  baseURL?: string; // default https://generativelanguage.googleapis.com
  fetchImpl?: typeof fetch; // for testing/override
};

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: unknown } }
  | { functionResponse: { name: string; response?: unknown } }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { fileUri: string; mimeType?: string } };

export type GeminiContent = {
  role?: "user" | "model" | "function";
  parts: GeminiPart[];
};
export type GenerateContentRequest = {
  contents: GeminiContent[];
  tools?: unknown[];
  toolConfig?: unknown;
  safetySettings?: unknown[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
};

export type GenerateContentResponse = {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
  responseId?: string;
};

export type StreamedPart = {
  type: "text" | "functionCall" | "functionResponse" | "complete";
  text?: string;
  functionCall?: { name: string; args?: unknown };
  functionResponse?: { name: string; response?: unknown };
  finishReason?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

// Models
export type GeminiModel = {
  name: string; // e.g. models/gemini-1.5-pro
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

export type ListModelsResponse = { models: GeminiModel[] };

// Count tokens
export type CountTokensRequest = {
  contents: GeminiContent[];
};
export type CountTokensResponse = {
  totalTokens?: number; // alias
  totalTokenCount?: number;
};

// Embeddings
export type EmbedContentRequest = {
  content: GeminiContent;
  taskType?: string;
};
export type EmbedContentResponse = { embedding?: { value?: number[] } };

export type BatchEmbedContentsRequest = {
  requests: EmbedContentRequest[];
};
export type BatchEmbedContentsResponse = {
  embeddings?: Array<{ embedding?: { value?: number[] } }>;
};

/**
 * HTTP client for Gemini API with configuration state management
 */
// eslint-disable-next-line no-restricted-syntax -- HTTP client requires state management (apiKey, baseURL, fetchImpl)
export class GeminiFetchClient {
  private apiKey: string;
  private baseURL: string;
  private f: typeof fetch;

  constructor(opts: GeminiClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseURL = (opts.baseURL ? opts.baseURL : "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    this.f = opts.fetchImpl ? opts.fetchImpl : fetch;
  }

  async generateContent(
    model: string,
    body: GenerateContentRequest,
    abortSignal?: AbortSignal,
  ): Promise<GenerateContentResponse> {
    const url = new URL(`${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:generateContent`);
    url.searchParams.set("key", this.apiKey);
    const res = await this.f(url.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw httpErrorFromResponse(createResponseLike(res, text), text);
    }
    return (await res.json()) as GenerateContentResponse;
  }

  async *streamGenerateContent(
    model: string,
    body: GenerateContentRequest,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<GenerateContentResponse, void, unknown> {
    const url = new URL(`${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent`);
    url.searchParams.set("key", this.apiKey);
    const res = await this.f(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: abortSignal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw httpErrorFromResponse(createResponseLike(res, text), text);
    }
    const ct = res.headers.get("content-type");
    const ctype = (ct ? ct : "").toLowerCase();
    const mod = ctype.includes("text/event-stream") ? "sse" : "jsonl"; // GeminiはJSONLで返す実装もあるため既定はjsonl
    const generator = mod === "jsonl" ? yieldInnerJsonBlocks : yieldSSEParts;
    for await (const obj of generator(streamText(res.body))) {
      yield JSON.parse(obj) as GenerateContentResponse;
    }
  }

  async *streamGenerateParts(
    model: string,
    body: GenerateContentRequest,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<StreamedPart, void, unknown> {
    for await (const response of this.streamGenerateContent(model, body, abortSignal)) {
      const parts = this.parseResponseToParts(response);
      for (const part of parts) {
        yield part;
      }
    }
  }

  private parseResponseToParts(response: GenerateContentResponse): StreamedPart[] {
    const parts: StreamedPart[] = [];

    // Check for completion first
    const candidate = response.candidates?.[0];
    if (candidate?.finishReason) {
      parts.push({
        type: "complete",
        finishReason: candidate.finishReason,
        usageMetadata: response.usageMetadata,
      });
      return parts;
    }

    // Parse content parts
    const contentParts = candidate?.content?.parts;
    if (contentParts) {
      for (const part of contentParts) {
        if ("text" in part && part.text) {
          parts.push({
            type: "text",
            text: part.text,
          });
          continue;
        }
        if ("functionCall" in part && part.functionCall) {
          parts.push({
            type: "functionCall",
            functionCall: part.functionCall,
          });
          continue;
        }
        if ("functionResponse" in part && part.functionResponse) {
          parts.push({
            type: "functionResponse",
            functionResponse: part.functionResponse,
          });
        }
      }
    }

    return parts;
  }

  async listModels(): Promise<ListModelsResponse> {
    const url = new URL(`${this.baseURL}/v1beta/models`);
    url.searchParams.set("key", this.apiKey);
    const res = await this.f(url.toString(), { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw httpErrorFromResponse(createResponseLike(res, text), text);
    }
    return (await res.json()) as ListModelsResponse;
  }

  async getModel(name: string): Promise<GeminiModel> {
    const url = new URL(`${this.baseURL}/v1beta/${encodeURIComponent(name)}`);
    url.searchParams.set("key", this.apiKey);
    const res = await this.f(url.toString(), { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw httpErrorFromResponse(createResponseLike(res, text), text);
    }
    return (await res.json()) as GeminiModel;
  }

  async countTokens(model: string, body: CountTokensRequest, abortSignal?: AbortSignal): Promise<CountTokensResponse> {
    const url = new URL(`${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:countTokens`);
    url.searchParams.set("key", this.apiKey);
    const res = await this.f(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: abortSignal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw httpErrorFromResponse(createResponseLike(res, text), text);
    }
    const json = (await res.json()) as CountTokensResponse;
    if (json.totalTokenCount && !json.totalTokens) {
      json.totalTokens = json.totalTokenCount;
    }
    return json;
  }

  async embedContent(
    model: string,
    body: EmbedContentRequest,
    abortSignal?: AbortSignal,
  ): Promise<EmbedContentResponse> {
    const url = new URL(`${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:embedContent`);
    url.searchParams.set("key", this.apiKey);
    const res = await this.f(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: abortSignal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw httpErrorFromResponse(createResponseLike(res, text), text);
    }
    return (await res.json()) as EmbedContentResponse;
  }

  async batchEmbedContents(
    model: string,
    body: BatchEmbedContentsRequest,
    abortSignal?: AbortSignal,
  ): Promise<BatchEmbedContentsResponse> {
    const url = new URL(`${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`);
    url.searchParams.set("key", this.apiKey);
    const res = await this.f(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: abortSignal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw httpErrorFromResponse(createResponseLike(res, text), text);
    }
    return (await res.json()) as BatchEmbedContentsResponse;
  }
}
