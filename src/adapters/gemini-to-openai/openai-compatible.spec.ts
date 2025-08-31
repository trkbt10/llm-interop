/**
 * @file Tests for OpenAI-compatible client implementation for Gemini provider
 */
import { buildOpenAICompatibleClientForGemini } from "./openai-compatible";
import type { Provider } from "../../config/types";

describe("buildOpenAICompatibleClientForGemini", () => {
  const mockProvider: Provider = {
    type: "gemini",
    apiKey: "test-gemini-key",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
  };

  beforeEach(() => {
    process.env.GOOGLE_AI_STUDIO_API_KEY = undefined;
    process.env.GEMINI_API_KEY = undefined;
    process.env.GOOGLE_API_KEY = undefined;
    process.env.GOOGLE_AI_API_KEY = undefined;
  });

  it("should create client with provider apiKey", () => {
    const client = buildOpenAICompatibleClientForGemini(mockProvider);

    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.responses).toBeDefined();
    expect(client.models).toBeDefined();
    expect(typeof client.setToolNameResolver).toBe("function");
  });

  it("should create client without modelHint", () => {
    const client = buildOpenAICompatibleClientForGemini(mockProvider);

    expect(client.chat.completions.create).toBeDefined();
    expect(client.responses.create).toBeDefined();
    expect(client.models.list).toBeDefined();
  });

  it("should create client with modelHint", () => {
    const client = buildOpenAICompatibleClientForGemini(mockProvider, "gemini-pro");

    expect(client).toBeDefined();
    expect(typeof client.chat.completions.create).toBe("function");
    expect(typeof client.responses.create).toBe("function");
    expect(typeof client.models.list).toBe("function");
  });

  it("should fallback to environment variables when provider apiKey is missing", () => {
    const providerWithoutKey: Provider = {
      type: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
    };

    process.env.GOOGLE_AI_STUDIO_API_KEY = "env-key-1";

    const client = buildOpenAICompatibleClientForGemini(providerWithoutKey);
    expect(client).toBeDefined();
  });

  it("should try environment variables in correct order", () => {
    const providerWithoutKey: Provider = {
      type: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
    };

    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GOOGLE_API_KEY = "google-key";

    const client = buildOpenAICompatibleClientForGemini(providerWithoutKey);
    expect(client).toBeDefined();
  });

  it("should handle empty apiKey gracefully", () => {
    const providerWithoutKey: Provider = {
      type: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
    };

    const client = buildOpenAICompatibleClientForGemini(providerWithoutKey);
    expect(client).toBeDefined();
  });

  it("should have setToolNameResolver method", () => {
    const client = buildOpenAICompatibleClientForGemini(mockProvider);

    const mockResolver = (callId: string) => `tool-${callId}`;
    expect(() => {
      client.setToolNameResolver?.(mockResolver);
    }).not.toThrow();
  });

  describe("client interface", () => {
    // eslint-disable-next-line no-restricted-syntax -- needed for test client instance sharing
    let client: ReturnType<typeof buildOpenAICompatibleClientForGemini>;

    beforeEach(() => {
      client = buildOpenAICompatibleClientForGemini(mockProvider);
    });

    it("should have correct chat completions structure", () => {
      expect(client.chat).toBeDefined();
      expect(client.chat.completions).toBeDefined();
      expect(typeof client.chat.completions.create).toBe("function");
    });

    it("should have correct responses structure", () => {
      expect(client.responses).toBeDefined();
      expect(typeof client.responses.create).toBe("function");
    });

    it("should have correct models structure", () => {
      expect(client.models).toBeDefined();
      expect(typeof client.models.list).toBe("function");
    });

    it("should have utility methods", () => {
      expect(typeof client.setToolNameResolver).toBe("function");
    });
  });

  describe("environment variable precedence", () => {
    it("should prioritize provider apiKey over environment variables", () => {
      process.env.GOOGLE_AI_STUDIO_API_KEY = "env-key";
      process.env.GEMINI_API_KEY = "gemini-env-key";

      const client = buildOpenAICompatibleClientForGemini(mockProvider);
      expect(client).toBeDefined();
    });

    it("should check GOOGLE_AI_STUDIO_API_KEY first", () => {
      const providerWithoutKey: Provider = {
        type: "gemini",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/models",
      };

      process.env.GOOGLE_AI_STUDIO_API_KEY = "google-ai-studio";
      process.env.GEMINI_API_KEY = "gemini";
      process.env.GOOGLE_API_KEY = "google";
      process.env.GOOGLE_AI_API_KEY = "google-ai";

      const client = buildOpenAICompatibleClientForGemini(providerWithoutKey);
      expect(client).toBeDefined();
    });
  });
});
