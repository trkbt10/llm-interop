/**
 * @file Convert JSON Schema to TypeScript-like syntax for Harmony.
 */

// JSON Schema interface
type JSONSchemaType = {
  type?: string;
  enum?: unknown[];
  items?: JSONSchemaType;
  properties?: Record<string, JSONSchemaType>;
  required?: string[];
  anyOf?: JSONSchemaType[];
  oneOf?: JSONSchemaType[];
  description?: string;
  default?: unknown;
  [key: string]: unknown;
};

/**
 * Converts JSON Schema definitions into TypeScript-style type representations for Harmony.
 * Transforms complex schema objects into readable TypeScript syntax that LLMs can understand
 * when working with function parameters and tool definitions. Essential for providing clear
 * type context in Harmony system messages and enabling proper tool parameter validation.
 *
 * @param schema - JSON Schema object defining parameter types and constraints
 * @param indent - Indentation string for formatting nested object structures
 * @returns TypeScript-style type string representing the schema structure
 */
export function convertJsonSchemaToTypeScript(schema?: JSONSchemaType, indent: string = ""): string {
  if (!schema) {
    return "unknown";
  }

  switch (schema.type) {
    case "string":
      if (schema.enum) {
        return schema.enum.map((v: unknown) => `"${String(v)}"`).join(" | ");
      }
      return "string";

    case "number":
    case "integer":
      return "number";

    case "boolean":
      return "boolean";

    case "null":
      return "null";

    case "array":
      if (schema.items) {
        const itemType = convertJsonSchemaToTypeScript(schema.items, indent);
        return `${itemType}[]`;
      }
      return "unknown[]";

    case "object":
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([key, propSchema]: [string, JSONSchemaType]) => {
            const required = schema.required?.includes(key);
            const optional = required ? "" : "?";
            const description = propSchema.description;
            const type = convertJsonSchemaToTypeScript(propSchema, indent + "  ");

            // eslint-disable-next-line no-restricted-syntax -- Building dynamic string content requires accumulation
            let result = "";
            if (description) {
              result += `${indent}// ${description}\n`;
            }

            // Handle enum with default
            if (propSchema.enum && propSchema.default) {
              result += `${indent}${key}${optional}: ${type}, // default: ${propSchema.default}`;
              return result;
            }

            result += `${indent}${key}${optional}: ${type},`;

            return result;
          })
          .join("\n");

        return `{\n${props}\n${indent.slice(2)}}`;
      }
      return "Record<string, unknown>";

    default:
      // Handle union types
      if (schema.anyOf || schema.oneOf) {
        const unionSchemas = schema.anyOf ? schema.anyOf : schema.oneOf;
        if (unionSchemas) {
          const types = unionSchemas
            .map((s: unknown) => convertJsonSchemaToTypeScript(s as JSONSchemaType, indent))
            .join(" | ");
          return types;
        }
      }

      return "unknown";
  }
}
