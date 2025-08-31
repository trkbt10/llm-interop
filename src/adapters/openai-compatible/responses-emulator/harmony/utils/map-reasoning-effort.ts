/**
 * @file Map OpenAI reasoning effort to Harmony format.
 */

import type { Reasoning } from "../types";
import { REASONING_LEVELS } from "../constants";
import type { ReasoningLevel } from "../constants";

/**
 * Translates OpenAI reasoning effort specifications into Harmony-compatible levels.
 * Bridges the conceptual gap between OpenAI's reasoning effort terminology and
 * Harmony's internal reasoning level system, ensuring consistent reasoning behavior
 * regardless of the input format. Provides sensible defaults for optimal performance.
 *
 * @param reasoning - OpenAI reasoning configuration with effort specification
 * @returns Harmony reasoning level optimized for the requested effort intensity
 */
export function mapReasoningEffort(reasoning?: Reasoning): ReasoningLevel {
  if (!reasoning?.effort) {
    return REASONING_LEVELS.MEDIUM; // default
  }

  // Map OpenAI reasoning efforts to Harmony format
  switch (reasoning.effort) {
    case "high":
      return REASONING_LEVELS.HIGH;
    case "medium":
      return REASONING_LEVELS.MEDIUM;
    case "low":
    case "minimal":
      return REASONING_LEVELS.LOW;
    default:
      return REASONING_LEVELS.MEDIUM;
  }
}
