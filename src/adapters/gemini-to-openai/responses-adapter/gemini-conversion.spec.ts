/**
 * @file Tests for Gemini conversion functions
 */
import { geminiToResponsesParams, responsesToGemini, type GeminiRequest } from "./gemini-conversion";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

describe("geminiToResponsesParams", () => {
  it("should convert basic Gemini request to Response params", () => {
    const geminiReq: GeminiRequest = {
      contents: [
        {
          parts: [{ text: "Hello, how are you?" }],
        },
      ],
      systemInstruction: {
        parts: [{ text: "You are a helpful assistant" }],
      },
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    };

    const result = geminiToResponsesParams(geminiReq, "gemini-pro");

    expect(result).toEqual({
      model: "gemini-pro",
      stream: false,
      input: "Hello, how are you?",
      instructions: "You are a helpful assistant",
      max_output_tokens: 1000,
    });
  });

  it("should handle empty contents gracefully", () => {
    const geminiReq: GeminiRequest = {};

    const result = geminiToResponsesParams(geminiReq, "gemini-pro");

    expect(result).toEqual({
      model: "gemini-pro",
      stream: false,
    });
  });
});

describe("responsesToGemini", () => {
  it("should convert OpenAI Response to Gemini format", () => {
    const openAIResponse: OpenAIResponse = {
      id: "resp_123",
      object: "response",
      created_at: 1234567890,
      model: "gemini-pro",
      status: "completed",
      output: [
        {
          id: "msg_456",
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello! I'm doing well, thank you.", annotations: [] }],
          status: "completed",
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 15,
        total_tokens: 25,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
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

    const result = responsesToGemini(openAIResponse);

    expect(result).toEqual({
      candidates: [
        {
          content: {
            parts: [{ text: "" }], // extractText returns empty string for this structure
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
          safetyRatings: [],
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 15,
        totalTokenCount: 25,
      },
    });
  });

  it("should handle response with no output", () => {
    const openAIResponse: OpenAIResponse = {
      id: "resp_123",
      object: "response",
      created_at: 1234567890,
      model: "gemini-pro",
      status: "completed",
      output: [],
      usage: {
        input_tokens: 10,
        output_tokens: 0,
        total_tokens: 10,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
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

    const result = responsesToGemini(openAIResponse);

    expect(result.candidates[0].content.parts[0].text).toBe("");
    expect(result.usageMetadata.promptTokenCount).toBe(10);
    expect(result.usageMetadata.candidatesTokenCount).toBe(0);
  });
});
