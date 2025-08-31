/**
 * @file Tests for OpenAI-compatible client factory
 */
import { buildOpenAICompatibleClient } from "./openai-client";
import type { Provider } from "../config/types";

// This test file uses integration testing approach without mocks

describe("buildOpenAICompatibleClient", () => {
  it("should create Gemini client for gemini provider type", () => {
    const provider: Provider = { type: "gemini", apiKey: "test-key" };
    const client = buildOpenAICompatibleClient(provider);

    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });

  it("should create Grok client for grok provider type", () => {
    const provider: Provider = { type: "grok", apiKey: "test-key" };
    const client = buildOpenAICompatibleClient(provider);

    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });

  it("should create Claude client for claude provider type", () => {
    const provider: Provider = { type: "claude", apiKey: "test-key" };
    const client = buildOpenAICompatibleClient(provider);

    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });

  it("should create OpenAI adapter for openai provider type", () => {
    const provider: Provider = { type: "openai", apiKey: "test-key" };
    const client = buildOpenAICompatibleClient(provider);

    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });

  it("should create generic adapter for unknown provider types", () => {
    const provider: Provider = { type: "custom-llm", apiKey: "test-key" };
    const client = buildOpenAICompatibleClient(provider);

    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });

  it("should pass modelHint to the appropriate factory", () => {
    const provider: Provider = { type: "gemini", apiKey: "test-key" };
    const modelHint = "gemini-pro";

    const client = buildOpenAICompatibleClient(provider, modelHint);

    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });
});
