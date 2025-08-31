/**
 * @file Gemini v1beta types used by the adapter
 *
 * These types mirror the public v1beta GenerateContent request/response shapes
 * from the Google Generative Language API (as exposed by @google/genai).
 * They are defined locally to avoid coupling with internal fetch client types.
 */

// Parts supported in this adapter (text + function messaging subset)
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

// Request for models/{model}:generateContent
export type GeminiRequest = {
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

// Response from models/{model}:generateContent
export type GeminiResponse = {
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

// Streaming chunk shape used by streamGenerateContent
export type GeminiStreamChunk = {
  candidates: Array<{
    content: { parts: Array<{ text: string } | { functionCall: { name: string; args?: unknown } }>; role: string };
    index: number;
  }>;
};
