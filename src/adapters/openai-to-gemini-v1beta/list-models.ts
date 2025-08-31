/**
 * @file listModels implementation for OpenAI → Gemini v1beta adapter
 */
import type { OpenAICompatibleClient } from "../openai-client-types";

/**
 * Map OpenAI-compatible model list into Gemini v1beta models surface.
 */
export async function listModels(client: OpenAICompatibleClient): Promise<{
  models: Array<{
    name: string;
    displayName: string;
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportedGenerationMethods: string[];
  }>;
}> {
  const models = await client.models.list();
  return {
    models: models.data.map((m) => ({
      name: `models/${m.id}`,
      displayName: m.id,
      description: `Model: ${m.id}`,
      inputTokenLimit: 1000000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
    })),
  };
}
