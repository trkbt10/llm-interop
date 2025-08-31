/**
 * @file Conversion functions between Gemini request/response format and OpenAI Responses API
 * Provides bidirectional conversion utilities for transforming Gemini requests into OpenAI
 * Response API parameters and converting OpenAI responses back into Gemini format.
 * Used primarily for emulating Gemini endpoints while maintaining OpenAI API compatibility.
 */
import type {
  Response as OpenAIResponse,
  ResponseCreateParams,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
  Tool,
} from "openai/resources/responses/responses";
import { hasGeminiTextProperty } from "../../../providers/gemini/guards";

/**
 * Gemini request structure with required fields for endpoint emulation.
 */
export type GeminiRequest = {
  contents?: Array<{ parts?: Array<{ text?: string }> }>;
  systemInstruction?: { parts?: Array<{ text?: string }> };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
  };
  tools?: Array<{ functionDeclarations?: unknown[] }>;
};

/**
 * Gemini response structure for endpoint emulation.
 */
export type GeminiResponse = {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: unknown[];
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
};

/**
 * Gemini streaming chunk structure for endpoint emulation.
 */
export type GeminiStreamChunk = {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    index: number;
  }>;
};

/**
 * Converts Gemini request format to OpenAI Responses API parameters.
 * Extracts input text, system instructions, generation config, and tools from Gemini
 * request structure and transforms them into OpenAI Response API compatible parameters.
 * Essential for emulating Gemini endpoints using OpenAI Response API backend.
 *
 * @param geminiReq - Gemini request containing contents, system instructions, and config
 * @param modelId - Model identifier to include in the converted parameters
 * @returns OpenAI Response API compatible parameters for the request
 */
export function geminiToResponsesParams(geminiReq: GeminiRequest, modelId: string): ResponseCreateParams {
  const params: ResponseCreateParams = {
    model: modelId,
    stream: false, // Will be set based on endpoint type
  };

  // Extract input from Gemini contents
  if (geminiReq.contents && geminiReq.contents.length > 0) {
    const parts = geminiReq.contents[0]?.parts;
    if (parts && parts.length > 0) {
      const firstPart = parts[0];
      const inputText = firstPart?.text;
      params.input = inputText !== undefined ? inputText : "";
    }
  }

  // Map system instructions
  if (geminiReq.systemInstruction?.parts?.[0]?.text) {
    params.instructions = geminiReq.systemInstruction.parts[0].text;
  }

  // Map generation config
  if (geminiReq.generationConfig) {
    if (geminiReq.generationConfig.maxOutputTokens) {
      params.max_output_tokens = geminiReq.generationConfig.maxOutputTokens;
    }
  }

  // Map tools (function declarations)
  if (geminiReq.tools && geminiReq.tools.length > 0) {
    const firstTool = geminiReq.tools[0];
    const declarations = firstTool?.functionDeclarations;
    params.tools = declarations !== undefined ? (declarations as Tool[]) : [];
  }

  return params;
}

/**
 * Converts OpenAI Response API result to Gemini response format.
 * Transforms OpenAI response output into Gemini's candidate-based structure with
 * proper text extraction, role assignment, and usage metadata mapping.
 * Essential for maintaining Gemini API compatibility when using OpenAI backend.
 *
 * @param response - OpenAI Response API response containing output and usage data
 * @returns Gemini-compatible response with candidates and usage metadata
 */
export function responsesToGemini(response: OpenAIResponse): GeminiResponse {
  const extractText = (output: unknown[]): string => {
    if (!Array.isArray(output) || output.length === 0) {
      return "";
    }

    const firstOutput = output[0];

    if (hasGeminiTextProperty(firstOutput)) {
      return firstOutput.text;
    }

    return "";
  };

  const outputArray = response.output !== undefined ? response.output : [];
  const text = extractText(outputArray);

  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
          role: "model",
        },
        finishReason: "STOP",
        index: 0,
        safetyRatings: [],
      },
    ],
    usageMetadata: {
      promptTokenCount: response.usage?.input_tokens ?? 0,
      candidatesTokenCount: response.usage?.output_tokens ?? 0,
      totalTokenCount: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    },
  };
}

/**
 * Converts OpenAI Response API streaming events to Gemini streaming chunks.
 * Processes OpenAI Response API stream events and transforms them into Gemini's
 * streaming format with proper candidate structure and text delta handling.
 * Essential for maintaining Gemini streaming API compatibility with OpenAI backend.
 *
 * @param stream - OpenAI Response API stream events to convert
 * @yields Gemini-compatible streaming chunks with candidate text parts
 */
export async function* responsesToGeminiStream(
  stream: AsyncIterable<ResponseStreamEvent>,
): AsyncIterable<GeminiStreamChunk> {
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      const textEvent = event as ResponseTextDeltaEvent;
      const deltaText = textEvent.delta !== undefined ? textEvent.delta : "";
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: deltaText }],
              role: "model",
            },
            index: 0,
          },
        ],
      };
    }
  }
}
