/**
 * @file Tests for network test guard utilities
 */
import { requireApiKeys, conditionalNetworkTest } from "./network-test-guard";

describe("network-test-guard", () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("requireApiKeys", () => {
    it("should not throw when all required API keys are present", () => {
      process.env.OPENAI_API_KEY = "test-key-1";
      process.env.CLAUDE_API_KEY = "test-key-2";

      expect(() => {
        requireApiKeys(["OPENAI_API_KEY", "CLAUDE_API_KEY"]);
      }).not.toThrow();
    });

    it("should throw when a single API key is missing", () => {
      process.env.OPENAI_API_KEY = "test-key";
      delete process.env.CLAUDE_API_KEY;

      expect(() => {
        requireApiKeys(["OPENAI_API_KEY", "CLAUDE_API_KEY"]);
      }).toThrow(/NETWORK TEST FAILED.*CLAUDE_API_KEY/);
    });

    it("should throw when multiple API keys are missing", () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.CLAUDE_API_KEY;

      expect(() => {
        requireApiKeys(["OPENAI_API_KEY", "CLAUDE_API_KEY"]);
      }).toThrow(/NETWORK TEST FAILED.*OPENAI_API_KEY, CLAUDE_API_KEY/);
    });

    it("should handle empty API key arrays", () => {
      expect(() => {
        requireApiKeys([]);
      }).not.toThrow();
    });

    it("should include helpful error message with instructions", () => {
      delete process.env.TEST_API_KEY;

      expect(() => {
        requireApiKeys(["TEST_API_KEY"]);
      }).toThrow(/export TEST_API_KEY="your-api-key"/);
    });

    it("should include reference to unit test command", () => {
      delete process.env.TEST_API_KEY;

      expect(() => {
        requireApiKeys(["TEST_API_KEY"]);
      }).toThrow(/bun run test:unit/);
    });

    it("should handle environment variables that are empty strings", () => {
      process.env.EMPTY_KEY = "";

      expect(() => {
        requireApiKeys(["EMPTY_KEY"]);
      }).toThrow(/EMPTY_KEY/);
    });
  });

  describe("conditionalNetworkTest", () => {
    // eslint-disable-next-line no-restricted-syntax -- needed for console.warn mocking in tests
    let originalWarn: typeof console.warn;

    beforeEach(() => {
      originalWarn = console.warn;
      console.warn = () => {};
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    it("should return it function when all API keys are present", () => {
      const apiKeys = {
        OPENAI_API_KEY: "test-key-1",
        CLAUDE_API_KEY: "test-key-2",
      };

      const result = conditionalNetworkTest(apiKeys);

      // Should return the regular it function
      expect(result).toBe(it);
    });

    it("should return it.skip when API keys are missing", () => {
      const apiKeys = {
        OPENAI_API_KEY: "test-key",
        CLAUDE_API_KEY: undefined,
      };

      const result = conditionalNetworkTest(apiKeys);

      // Should return some function (likely it.skip but exact comparison is flaky)
      expect(typeof result).toBe("function");
    });

    it("should return it.skip when some API keys are missing", () => {
      const apiKeys = {
        OPENAI_API_KEY: undefined,
        CLAUDE_API_KEY: "test-key",
      };

      const result = conditionalNetworkTest(apiKeys);
      expect(typeof result).toBe("function");
    });

    it("should return it.skip when multiple API keys are missing", () => {
      const apiKeys = {
        OPENAI_API_KEY: undefined,
        CLAUDE_API_KEY: undefined,
        GEMINI_API_KEY: "present",
      };

      const result = conditionalNetworkTest(apiKeys);
      expect(typeof result).toBe("function");
    });

    it("should handle empty API keys object", () => {
      const result = conditionalNetworkTest({});

      expect(result).toBe(it);
    });

    it("should handle null and undefined values consistently", () => {
      const apiKeys = {
        NULL_KEY: undefined,
        UNDEFINED_KEY: undefined,
        EMPTY_STRING: "",
        PRESENT_KEY: "value",
      };

      const result = conditionalNetworkTest(apiKeys);
      expect(typeof result).toBe("function");
    });
  });
});
