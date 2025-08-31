/**
 * @file Type guard functions and utility predicates for Gemini provider
 * Provides runtime type checking utilities and guard functions for safe type narrowing,
 * enabling robust type validation and ensuring type safety across Gemini API boundaries.
 */
import type { GenerateContentResponse, GeminiContent, GeminiPart } from "./client/fetch-client";
import { isObject } from "../../utils/type-guards";

/**
 * Validates that unknown data conforms to Gemini API response structure.
 * Essential for safe response processing when dealing with network data or
 * API responses that might not match expected types. Prevents runtime errors
 * by ensuring response objects contain required Gemini response properties.
 *
 * @param v - Unknown data requiring Gemini response validation
 * @returns True if data matches GenerateContentResponse structure
 */
export function isGeminiResponse(v: unknown): v is GenerateContentResponse {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  return "candidates" in o ? true : "usageMetadata" in o;
}

/**
 * Validates and filters streaming data to ensure all chunks are valid Gemini responses.
 * Provides type-safe streaming by verifying each chunk against Gemini response schema,
 * throwing errors for malformed data to prevent downstream processing issues.
 * Critical for maintaining data integrity in streaming Gemini workflows.
 *
 * @param src - Source stream containing potentially mixed data types
 * @yields Validated Gemini response chunks
 * @throws TypeError when encountering non-Gemini response data
 */
export async function* ensureGeminiStream(
  src: AsyncIterable<unknown>,
): AsyncGenerator<GenerateContentResponse, void, unknown> {
  for await (const it of src) {
    if (isGeminiResponse(it)) {
      yield it;
      continue;
    }
    throw new TypeError("Stream chunk is not a Gemini GenerateContentResponse shape");
  }
}

// Gemini parts guards

/**
 * Identifies text content parts within Gemini response structures.
 * Essential for extracting readable text from complex Gemini responses that
 * may contain mixed content types (text, function calls, etc.). Enables
 * safe text processing without type casting errors.
 *
 * @param p - Potential Gemini part requiring text validation
 * @returns True if part contains valid text content
 */
export function isGeminiTextPart(p: unknown): p is Extract<GeminiPart, { text: string }> {
  return (
    typeof p === "object" &&
    p !== null &&
    (p as { text?: unknown }).text !== undefined &&
    typeof (p as { text?: unknown }).text === "string"
  );
}

/**
 * Detects function call parts within Gemini response content.
 * Critical for identifying when Gemini is invoking tools or functions,
 * enabling proper function call handling and tool execution workflows.
 * Ensures safe access to function call metadata without runtime errors.
 *
 * @param p - Potential Gemini part requiring function call validation
 * @returns True if part contains valid function call structure
 */
export function isGeminiFunctionCallPart(
  p: unknown,
): p is Extract<GeminiPart, { functionCall: { name: string; args?: unknown } }> {
  return (
    typeof p === "object" &&
    p !== null &&
    (p as { functionCall?: unknown }).functionCall !== undefined &&
    typeof (p as { functionCall?: { name?: unknown } }).functionCall?.name === "string"
  );
}

/**
 * Detects function response parts within Gemini content for tool result processing.
 * Critical for identifying when Gemini has received tool execution results,
 * enabling proper function response handling and result integration workflows.
 * Essential for maintaining tool execution chains.
 *
 * @param p - Potential Gemini part requiring function response validation
 * @returns True if part contains valid function response structure
 */
export function isGeminiFunctionResponsePart(
  p: unknown,
): p is Extract<GeminiPart, { functionResponse: { name: string; response?: unknown } }> {
  return (
    typeof p === "object" &&
    p !== null &&
    (p as { functionResponse?: unknown }).functionResponse !== undefined &&
    typeof (p as { functionResponse?: { name?: unknown } }).functionResponse?.name === "string"
  );
}

// Helpers to read candidate parts safely

/**
 * Extracts the primary candidate from Gemini response for content processing.
 * Gemini responses contain multiple candidates but typically only the first is used.
 * Provides safe access to candidate content and finish reasons while handling
 * potential missing or malformed candidate arrays.
 *
 * @param resp - Gemini GenerateContent response containing candidate array
 * @returns First candidate with content and finish reason, or undefined if none
 */
export function getFirstCandidate(
  resp: GenerateContentResponse,
): { content?: GeminiContent; finishReason?: string } | undefined {
  const arr = (resp as { candidates?: Array<{ content?: GeminiContent; finishReason?: string }> }).candidates;
  return Array.isArray(arr) ? arr[0] : undefined;
}

/**
 * Extracts content parts from Gemini response candidate for content processing.
 * Provides safe access to the parts array within Gemini response structure,
 * handling potential missing or malformed content. Essential for processing
 * text, function calls, and other content types from Gemini responses.
 *
 * @param resp - Gemini GenerateContent response requiring part extraction
 * @returns Array of Gemini parts from the first candidate, or empty array if none
 */
export function getCandidateParts(resp: GenerateContentResponse): GeminiPart[] {
  const cand = getFirstCandidate(resp);
  const content = cand?.content;
  const parts = (content as { parts?: unknown })?.parts;
  return Array.isArray(parts) ? (parts as GeminiPart[]) : [];
}

/**
 * Type guard to check if an object has a text property with string value.
 * @param obj - The object to check
 * @returns True if object has a text property of type string
 */
export function hasGeminiTextProperty(obj: unknown): obj is { text: string } {
  if (!isObject(obj)) {
    return false;
  }

  const hasText = "text" in obj;
  if (!hasText) {
    return false;
  }

  return typeof (obj as { text?: unknown }).text === "string";
}
