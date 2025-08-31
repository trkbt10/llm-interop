/**
 * @file Converts Gemini responses to OpenAI Responses API format
 * Transforms Google Gemini generateContent responses into OpenAI-compatible response structures,
 * extracting text content and function calls while maintaining proper token usage reporting and
 * response formatting for OpenAI API compatibility.
 */
import { GenerateContentResponse } from "../../../providers/gemini/client/fetch-client";
import { getCandidateParts, isGeminiFunctionCallPart, isGeminiTextPart } from "../../../providers/gemini/guards";
import {
  generateOpenAICallId,
  generateOpenAIMessageId,
  generateOpenAIResponseId,
} from "../../conversation/id-conversion";
import type {
  Response,
  ResponseOutputMessage,
  ResponseOutputText,
  ResponseUsage,
} from "openai/resources/responses/responses";

function extractText(resp: GenerateContentResponse): string {
  return getCandidateParts(resp)
    .filter(isGeminiTextPart)
    .map((p) => p.text)
    .join("");
}

function extractFunctionCalls(resp: GenerateContentResponse): Array<{ id: string; name: string; arguments?: string }> {
  const out: Array<{ id: string; name: string; arguments?: string }> = [];
  for (const p of getCandidateParts(resp)) {
    if (isGeminiFunctionCallPart(p)) {
      const args = p.functionCall.args !== undefined ? JSON.stringify(p.functionCall.args) : undefined;
      const callId = generateOpenAICallId();
      out.push({ id: callId, name: p.functionCall.name, arguments: args });
    }
  }
  return out;
}

/**
 * Transforms Gemini API responses into OpenAI Response API compatible format.
 * Extracts text content and function calls from Gemini's candidate-based response structure
 * and converts them into OpenAI's output item format. Essential for enabling Gemini responses
 * to work seamlessly with OpenAI Response API consumers and processing pipelines.
 *
 * @param resp - Gemini GenerateContent response containing candidates and usage metadata
 * @param model - Model identifier to include in the converted response (default: "gemini")
 * @returns OpenAI-compatible response with converted output items and usage statistics
 */
export function geminiToOpenAIResponse(resp: GenerateContentResponse, model = "gemini"): Response {
  const text = extractText(resp);
  const calls = extractFunctionCalls(resp);
  const usage = createResponseUsage(resp.usageMetadata);
  const out: Response = {
    id: generateOpenAIResponseId(),
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model,
    status: "completed",
    output: [],
    usage,
    output_text: "",
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    parallel_tool_calls: false,
    temperature: null,
    tool_choice: "none",
    tools: [],
    top_p: null,
  };
  if (text) {
    out.output.push({
      id: generateOpenAIMessageId(),
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text, annotations: [] } as ResponseOutputText],
    } as ResponseOutputMessage);
  }
  for (const c of calls) {
    out.output.push({
      type: "function_call",
      id: c.id,
      name: c.name,
      arguments: c.arguments ?? "",
      call_id: c.id,
    });
  }
  return out;
}

/**
 * Creates a ResponseUsage object from Gemini usage metadata
 * Converts Gemini's token counting format to OpenAI Response API format with proper token details
 *
 * @param usageMetadata - Gemini usage metadata containing token counts
 * @returns OpenAI-compatible ResponseUsage object with detailed token breakdown
 */
function createResponseUsage(usageMetadata?: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}): ResponseUsage {
  const inputTokens = usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens = usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

  return {
    input_tokens: inputTokens,
    input_tokens_details: {
      cached_tokens: 0, // Gemini doesn't provide cached token info, default to 0
    },
    output_tokens: outputTokens,
    output_tokens_details: {
      reasoning_tokens: 0, // Gemini doesn't provide reasoning token info, default to 0
    },
    total_tokens: totalTokens,
  };
}
