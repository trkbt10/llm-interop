/**
 * @file JSON Schema normalization utilities for OpenAI compatibility requirements.
 * Transforms JSON schemas to meet OpenAI's strict validation rules for tool function parameters.
 * This is critical when using Claude or other providers' tool schemas with OpenAI's function calling,
 * ensuring schema compliance by enforcing required properties, removing unsupported formats, and
 * setting proper additionalProperties constraints.
 */

// JSON Schema type definitions
export type JSONSchemaProperty = {
  type?: string;
  format?: string;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
};

type JSONSchema = JSONSchemaProperty;

/**
 * Recursively ensures all object properties are listed in the required array
 */
function ensureRequiredRec(schema: JSONSchema): void {
  if (schema.type === "object" && typeof schema.properties === "object" && schema.properties !== null) {
    const props = Object.keys(schema.properties);
    const existing = Array.isArray(schema.required) ? schema.required : [];
    schema.required = Array.from(new Set([...existing, ...props]));
  }

  if (schema.type === "array" && schema.items) {
    ensureRequiredRec(schema.items);
  }

  if (typeof schema.properties === "object" && schema.properties !== null) {
    for (const key of Object.keys(schema.properties)) {
      ensureRequiredRec(schema.properties[key]);
    }
  }
}

/**
 * Removes unsupported format specifiers (like "uri") from schemas
 */
function removeUnsupportedFormats(schema: JSONSchema): void {
  if (schema.format === "uri") {
    delete schema.format;
  }
  if (schema.properties) {
    if (typeof schema.properties === "object" && schema.properties !== null) {
      for (const key of Object.keys(schema.properties)) {
        removeUnsupportedFormats(schema.properties[key]);
      }
    }
  }
  if (schema.items) {
    removeUnsupportedFormats(schema.items);
  }
}

/**
 * Ensures all object schemas have additionalProperties: false
 */
function ensureAdditionalPropertiesFalseRec(schema: JSONSchema): void {
  if (schema.type === "object") {
    schema.additionalProperties = false;
  }
  if (schema.items) {
    ensureAdditionalPropertiesFalseRec(schema.items);
  }
  if (schema.properties) {
    if (typeof schema.properties === "object" && schema.properties !== null) {
      for (const key of Object.keys(schema.properties)) {
        ensureAdditionalPropertiesFalseRec(schema.properties[key]);
      }
    }
  }
}

/**
 * Normalizes a JSON schema to be compatible with OpenAI's requirements
 * - Ensures all properties are marked as required
 * - Removes unsupported format specifiers
 * - Sets additionalProperties to false for all objects
 */
export function normalizeJSONSchemaForOpenAI(inputSchema: JSONSchema): JSONSchema {
  // Deep clone to avoid mutating the original
  const schema = structuredClone(inputSchema);

  // Apply all transformations
  ensureRequiredRec(schema);
  removeUnsupportedFormats(schema);
  ensureAdditionalPropertiesFalseRec(schema);

  return schema;
}
