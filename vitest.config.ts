/**
 * @file Vitest testing framework configuration
 *
 * This configuration sets up the Vitest test runner for the llm-interop
 * project with support for different test types:
 * - Unit tests: Fast, isolated tests with no external dependencies
 * - Integration tests: Complex workflow tests with mocked external calls
 * - Network tests: Tests requiring actual API calls (require API keys)
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    // Performance settings to prevent process bombs
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 2, // Limit to 2 threads to prevent overwhelming system
      },
    },
    // Timeout settings
    testTimeout: 10000, // 10 seconds for unit tests
    hookTimeout: 5000,
    teardownTimeout: 5000,
    // Default pattern excludes network tests to speed up development
    include: ["src/**/*.{spec,test}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.network.{spec,test}.{ts,tsx}", // Exclude network tests by default
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{spec,test}.{ts,tsx}", "src/**/*.d.ts"],
    },
  },
});
