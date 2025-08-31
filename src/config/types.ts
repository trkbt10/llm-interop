/**
 * @file Configuration schema for providers and routing.
 *
 * Goal: keep it small, explicit, and easy to understand.
 * The types here define what users can put into config files and how
 * the adapters interpret those settings.
 */

/**
 * A generic model type constructor
 */
export type ModelArrayType<T extends readonly string[]> = T[number];

/**
 * Declarative mapping for model names.
 *
 * - byGrade: choose a default model by qualitative "grade" (high/mid/low)
 * - aliases: map user-facing aliases to actual model IDs
 *
 * Example:
 * {
 *   byGrade: { high: "gpt-4o", mid: "gpt-4o-mini" },
 *   aliases: { "default": "gpt-4o", "fast": "gpt-4o-mini" }
 * }
 */
export type ModelMapping = {
  byGrade?: Partial<{
    [grade in "high" | "mid" | "low"]: string;
  }>;
  aliases?: Record<string, string>;
};

export type Provider = {
  /**
   * Provider type identifier. Built-ins: "openai", "claude", "gemini".
   * You can also pass any string for OpenAI-compatible third parties.
   */
  type: "openai" | "claude" | "gemini" | (string & {});

  /**
   * Default model ID to use for this provider.
   */
  model?: string;

  /**
   * Per-provider model mapping helpers (grades and alias table).
   */
  modelMapping?: ModelMapping;

  /**
   * Base URL for the provider endpoint (e.g. https://api.openai.com/v1).
   * Required for OpenAI-compatible third-party endpoints.
   */
  baseURL?: string;

  /**
   * API key for the provider. If omitted, other selection rules may apply
   * (see api.keyByModelPrefix below) and upstream may return 401.
   */
  apiKey?: string;

  /**
   * Extra headers to send with all requests.
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Low-level API behavior.
   */
  api?: {
    /**
     * Choose API keys by model prefix. The longest matching prefix wins.
     * Used by select-api-key to pick a key when multiple products are hosted
     * behind one endpoint.
     *
     * Example:
     * { "gpt-4": "OPENAI_KEY_FOR_GPT4", "gpt-3.5": "OPENAI_KEY_FOR_GPT35" }
     */
    keyByModelPrefix?: Record<string, string>;
  };
  /**
   * OpenAI compatibility meta options to control adapter behavior.
   * These options affect how the OpenAI-compatible factory routes requests
   * and whether it performs conversions and fallbacks.
   */
  openaiCompat?: {
    /**
     * Responses ⇄ Harmony conversion.
     * When enabled, the adapter:
     * - Builds Harmony-style ChatCompletion prompts from Responses params
     * - Parses Harmony-looking outputs back into Responses (events or object)
     * @default false
     */
    transformHarmony?: boolean;

    /**
     * Enable Responses API emulation using Chat Completions.
     * Use this when the upstream lacks native /v1/responses.
     * Requires explicit opt-in.
     * @default false
     */
    emulateResponsesWithChat?: boolean;

    /**
     * Prefer the native Responses API first when available.
     * If false and emulateResponsesWithChat=true, emulator is tried first.
     * @default true
     */
    preferResponsesAPI?: boolean;

    /**
     * Automatically fall back to the emulator (or native) on failure.
     * Disabled by default; when not enabled, the first failure is thrown
     * as-is (no masking). When enabled and all attempts fail, an AggregateError
     * is thrown containing all errors.
     * @default false
     */
    autoFallbackToEmulator?: boolean;
  };
};
