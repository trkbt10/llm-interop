/**
 * @file Network test guard utilities
 *
 * Provides utilities to ensure network tests fail fast when API keys are missing,
 * preventing accidental inclusion in unit test runs and providing clear error messages.
 */

/**
 * Guard function for network tests that require API keys.
 * Throws an error immediately if required environment variables are missing.
 *
 * @param requiredEnvVars - Array of required environment variable names
 * @throws Error if any required environment variable is missing
 */
export function requireApiKeys(requiredEnvVars: string[]): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `NETWORK TEST FAILED: Missing required API keys: ${missing.join(", ")}\n` +
        `This is a network test that requires actual API access.\n` +
        `Set the following environment variables:\n` +
        missing.map((key) => `  export ${key}="your-api-key"`).join("\n") +
        `\n\nTo run only unit tests (recommended for development):\n` +
        `  bun run test:unit`,
    );
  }
}

/**
 * Conditional test function that skips when API keys are missing.
 * Provides a clear skip message for better test output readability.
 *
 * @param apiKeys - Object with API key names and values
 * @returns it function or it.skip function
 */
export function conditionalNetworkTest(apiKeys: Record<string, string | undefined>): typeof it | typeof it.skip {
  const missing = Object.entries(apiKeys)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`⚠️  Skipping network tests - missing API keys: ${missing.join(", ")}`);
    return it.skip;
  }

  return it;
}
