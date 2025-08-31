/**
 * @file Model metadata normalization helpers layered on top of grade detection.
 * Provides utilities for detecting provider families, model capabilities, and normalizing
 * model information across different AI providers.
 */
import { detectModelGrade, type ModelGrade } from "./model-grade-detector";

export type ProviderFamily = "openai" | "anthropic" | "google" | "groq" | "xai" | "ollama" | "unknown";

export type ModelCapabilities = {
  text: boolean;
  vision: boolean;
  audio: boolean;
  tools: boolean;
  reasoning: boolean;
};

export type ModelInfo = {
  id: string;
  family: ProviderFamily;
  grade: ModelGrade;
  caps: ModelCapabilities;
};

/**
 * Detects the provider family for a given model ID.
 * Analyzes model ID patterns to determine which AI provider the model belongs to.
 *
 * @param id - Model identifier to analyze
 * @returns Provider family classification
 */
export function detectFamily(id: string): ProviderFamily {
  const s = id.toLowerCase();
  const isGptModel = s.startsWith("gpt-");
  const isOModel = s.startsWith("o");
  const matchesGptPattern = /gpt|o\d/.test(s);

  if (isGptModel) {
    return "openai";
  }
  if (isOModel) {
    return "openai";
  }
  if (matchesGptPattern) {
    return "openai";
  }
  const isClaudeModel = s.startsWith("claude");
  const isSonnetModel = s.includes("sonnet");
  const isHaikuModel = s.includes("haiku");
  const isOpusModel = s.includes("opus");

  if (isClaudeModel) {
    return "anthropic";
  }
  if (isSonnetModel) {
    return "anthropic";
  }
  if (isHaikuModel) {
    return "anthropic";
  }
  if (isOpusModel) {
    return "anthropic";
  }
  const isGeminiModel = s.startsWith("gemini");
  const isPalmModel = s.includes("palm");

  if (isGeminiModel) {
    return "google";
  }
  if (isPalmModel) {
    return "google";
  }
  if (s.startsWith("grok")) {
    return "xai";
  }
  const isLlamaModel = s.startsWith("llama");
  const isMixtralModel = s.startsWith("mixtral");
  const isQwenModel = s.startsWith("qwen");
  const isPhiModel = s.startsWith("phi");

  if (isLlamaModel) {
    return "ollama";
  }
  if (isMixtralModel) {
    return "ollama";
  }
  if (isQwenModel) {
    return "ollama";
  }
  if (isPhiModel) {
    return "ollama";
  }
  const isGroqModel = s.startsWith("groq");
  const isLlama3GroqModel = s.includes("llama3-groq");

  if (isGroqModel) {
    return "groq";
  }
  if (isLlama3GroqModel) {
    return "groq";
  }
  return "unknown";
}

/**
 * Detects the capabilities of a model based on its identifier.
 * Analyzes model ID patterns to determine supported features like vision, audio, tools, etc.
 *
 * @param id - Model identifier to analyze
 * @returns Object describing model capabilities
 */
export function detectCapabilities(id: string): ModelCapabilities {
  const s = id.toLowerCase();
  const text = true;
  const vision = /vision|gpt-4o|gpt-4\.1|sonnet|gemini.*flash|grok-\d.*(vision|vl)/.test(s);
  const audio = /whisper|tts|audio/.test(s);
  const tools = /tool|function|responses|json|gpt-4o|gpt-4\.1|sonnet|opus|grok-\d/.test(s);
  const reasoning = /thinking|reason|o\d|gpt-4\.1|gpt-5|grok-\d|opus/.test(s);
  return { text, vision, audio, tools, reasoning };
}

/**
 * Normalizes a list of model IDs into structured model information.
 * Processes raw model identifiers and enriches them with family, grade, and capability data.
 *
 * @param ids - Array of model identifiers to process
 * @param fallbackFamily - Default provider family for unknown models
 * @returns Array of normalized model information objects
 */
export function normalizeModels(ids: readonly string[], fallbackFamily: ProviderFamily): ModelInfo[] {
  return ids.map((id) => {
    const detectedFamily = detectFamily(id);
    return {
      id,
      family: detectedFamily === "unknown" ? fallbackFamily : detectedFamily,
      grade: detectModelGrade(id),
      caps: detectCapabilities(id),
    };
  });
}

/**
 * Converts normalized model information to OpenAI models list format.
 * Transforms model metadata into the standard OpenAI API models list response structure.
 *
 * @param modelInfos - Array of normalized model information
 * @returns OpenAI-compatible models list object
 */
export function toOpenAIModelsList(modelInfos: ModelInfo[]): {
  object: "list";
  data: { id: string; object: "model"; created: number; owned_by: string }[];
} {
  const data = modelInfos.map((m) => ({
    id: m.id,
    object: "model" as const,
    created: Math.floor(Date.now() / 1000),
    owned_by: m.family,
  }));
  return { object: "list", data };
}
