/**
 * @file Handle response format for structured outputs.
 */

import type { ResponseTextConfig } from "../../types";
import { hasResponseFormat } from "../../utils/type-guards";

/**
 * Processes structured output requirements into Harmony-compatible response format specifications.
 * Transforms JSON schema definitions from Response API text configuration into Harmony format
 * strings that guide LLM output structure. Critical for ensuring LLM responses conform to
 * expected schemas when structured data output is required.
 *
 * @param text - Response API text configuration containing JSON schema for structured outputs
 * @returns Harmony-formatted response format specification or undefined if no format required
 */
export function handleResponseFormat(text?: ResponseTextConfig): string | undefined {
  if (!text) {
    return undefined;
  }

  // Check if text config has response_format or structured output schema
  if (!hasResponseFormat(text)) {
    return undefined;
  }

  const { name, description, schema } = text.response_format.json_schema;

  if (!name || !schema) {
    return undefined;
  }

  // Format according to Harmony spec
  // eslint-disable-next-line no-restricted-syntax -- Building formatted response string requires accumulation
  let result = `# Response Formats\n\n## ${name}\n\n`;

  if (description) {
    result += `// ${description}\n`;
  }

  // Add the JSON schema directly (Harmony expects raw JSON schema)
  result += JSON.stringify(schema);

  return result;
}
