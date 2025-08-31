/**
 * @file Tests for JSON Schema normalization utilities
 */
import { normalizeJSONSchemaForOpenAI, type JSONSchemaProperty } from "./schema-normalizer";

describe("Schema Normalizer", () => {
  describe("normalizeJSONSchemaForOpenAI", () => {
    describe("Required properties normalization", () => {
      it("should add all properties to required array for object schema", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
            active: { type: "boolean" },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(expect.arrayContaining(["name", "age", "active"]));
        expect(result.required).toHaveLength(3);
      });

      it("should preserve existing required properties", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
          required: ["name"],
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(expect.arrayContaining(["name", "email", "phone"]));
        expect(result.required).toHaveLength(3);
      });

      it("should handle nested object properties", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: { type: "string" },
                contact: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    phone: { type: "string" },
                  },
                },
              },
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(["user"]);
        expect(result.properties?.user.required).toEqual(expect.arrayContaining(["name", "contact"]));
        expect(result.properties?.user.properties?.contact.required).toEqual(
          expect.arrayContaining(["email", "phone"]),
        );
      });

      it("should handle array items with object schemas", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  value: { type: "number" },
                },
              },
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(["items"]);
        expect(result.properties?.items.items?.required).toEqual(expect.arrayContaining(["id", "value"]));
      });

      it("should handle empty properties object", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {},
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual([]);
      });

      it("should handle object without properties", () => {
        const input: JSONSchemaProperty = {
          type: "object",
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toBeUndefined();
      });
    });

    describe("Format removal", () => {
      it("should remove uri format from string properties", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            website: { type: "string", format: "uri" },
            name: { type: "string", format: "name" },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.properties?.website.format).toBeUndefined();
        expect(result.properties?.name.format).toBe("name"); // Non-uri formats preserved
      });

      it("should recursively remove uri format from nested schemas", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            links: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri" },
                  title: { type: "string" },
                },
              },
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.properties?.links.items?.properties?.url.format).toBeUndefined();
        expect(result.properties?.links.items?.properties?.title.format).toBeUndefined();
      });

      it("should handle schemas without format property", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            name: { type: "string" },
            count: { type: "number" },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.properties?.name.format).toBeUndefined();
        expect(result.properties?.count.format).toBeUndefined();
      });

      it("should preserve non-uri formats", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            date: { type: "string", format: "date" },
            uuid: { type: "string", format: "uuid" },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.properties?.email.format).toBe("email");
        expect(result.properties?.date.format).toBe("date");
        expect(result.properties?.uuid.format).toBe("uuid");
      });
    });

    describe("AdditionalProperties normalization", () => {
      it("should set additionalProperties to false for object schemas", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.additionalProperties).toBe(false);
      });

      it("should override existing additionalProperties", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          additionalProperties: true,
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.additionalProperties).toBe(false);
      });

      it("should recursively set additionalProperties for nested objects", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                profile: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.additionalProperties).toBe(false);
        expect(result.properties?.user.additionalProperties).toBe(false);
        expect(result.properties?.user.properties?.profile.additionalProperties).toBe(false);
      });

      it("should handle array items with object schemas", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                },
                additionalProperties: true,
              },
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.additionalProperties).toBe(false);
        expect(result.properties?.items.items?.additionalProperties).toBe(false);
      });

      it("should not affect non-object schemas", () => {
        const input: JSONSchemaProperty = {
          type: "string",
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.additionalProperties).toBeUndefined();
      });
    });

    describe("Complex schema scenarios", () => {
      it("should handle complete function schema normalization", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            filters: {
              type: "object",
              properties: {
                category: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                },
                metadata: {
                  type: "object",
                  properties: {
                    source: { type: "string", format: "uri" },
                    priority: { type: "number" },
                  },
                  additionalProperties: true,
                },
              },
              required: ["category"],
            },
            options: {
              type: "object",
              properties: {
                limit: { type: "number" },
                sort: { type: "string" },
              },
            },
          },
          required: ["query"],
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        // Check top-level requirements
        expect(result.required).toEqual(expect.arrayContaining(["query", "filters", "options"]));
        expect(result.additionalProperties).toBe(false);

        // Check filters normalization
        expect(result.properties?.filters.required).toEqual(expect.arrayContaining(["category", "tags", "metadata"]));
        expect(result.properties?.filters.additionalProperties).toBe(false);

        // Check metadata normalization (uri format removed, additionalProperties set to false)
        expect(result.properties?.filters.properties?.metadata.required).toEqual(
          expect.arrayContaining(["source", "priority"]),
        );
        expect(result.properties?.filters.properties?.metadata.properties?.source.format).toBeUndefined();
        expect(result.properties?.filters.properties?.metadata.additionalProperties).toBe(false);

        // Check options normalization
        expect(result.properties?.options.required).toEqual(expect.arrayContaining(["limit", "sort"]));
        expect(result.properties?.options.additionalProperties).toBe(false);
      });

      it("should handle schema with enums and descriptions", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["active", "inactive", "pending"],
              description: "User status",
            },
            config: {
              type: "object",
              properties: {
                theme: {
                  type: "string",
                  enum: ["light", "dark"],
                  description: "UI theme preference",
                },
              },
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(expect.arrayContaining(["status", "config"]));
        expect(result.properties?.status.enum).toEqual(["active", "inactive", "pending"]);
        expect(result.properties?.status.description).toBe("User status");
        expect(result.properties?.config.required).toEqual(["theme"]);
        expect(result.properties?.config.properties?.theme.enum).toEqual(["light", "dark"]);
      });

      it("should preserve custom properties", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            data: { type: "string" },
          },
          customField: "preserved",
          "x-vendor-extension": { custom: true },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.customField).toBe("preserved");
        expect(result["x-vendor-extension"]).toEqual({ custom: true });
      });
    });

    describe("Edge cases", () => {
      it("should handle empty schema", () => {
        const input: JSONSchemaProperty = {};

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result).toEqual({});
      });

      it("should handle schema with null properties", () => {
        const input = {
          type: "object" as const,
          properties: null,
        };

        // @ts-expect-error: Intentionally passing invalid schema (properties: null) to test normalization behavior
        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.properties).toBeNull();
        expect(result.additionalProperties).toBe(false);
      });

      it("should handle schema with undefined properties", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: undefined,
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.properties).toBeUndefined();
        expect(result.additionalProperties).toBe(false);
      });

      it("should handle deeply nested array structures", () => {
        const input: JSONSchemaProperty = {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "string", format: "uri" },
              },
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.items?.items?.required).toEqual(["value"]);
        expect(result.items?.items?.properties?.value.format).toBeUndefined();
        expect(result.items?.items?.additionalProperties).toBe(false);
      });

      it("should not mutate the original schema", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            name: { type: "string", format: "uri" },
          },
          additionalProperties: true,
        };

        const originalInput = JSON.parse(JSON.stringify(input));
        const result = normalizeJSONSchemaForOpenAI(input);

        // Original should be unchanged
        expect(input).toEqual(originalInput);
        expect(input.additionalProperties).toBe(true);
        expect(input.properties?.name.format).toBe("uri");

        // Result should be normalized
        expect(result.additionalProperties).toBe(false);
        expect(result.properties?.name.format).toBeUndefined();
        expect(result.required).toEqual(["name"]);
      });

      it("should handle schemas with circular references safely", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        };

        // Create circular reference after initial setup to test structured clone
        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(["name"]);
        expect(result.additionalProperties).toBe(false);
      });
    });

    describe("Real-world schema examples", () => {
      it("should normalize OpenAI function calling schema", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA",
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "Temperature unit",
            },
            details: {
              type: "object",
              properties: {
                includeHumidity: { type: "boolean" },
                includePressure: { type: "boolean" },
              },
            },
          },
          required: ["location"],
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(expect.arrayContaining(["location", "unit", "details"]));
        expect(result.properties?.details.required).toEqual(
          expect.arrayContaining(["includeHumidity", "includePressure"]),
        );
        expect(result.additionalProperties).toBe(false);
        expect(result.properties?.details.additionalProperties).toBe(false);
      });

      it("should normalize Claude tool schema", () => {
        const input: JSONSchemaProperty = {
          type: "object",
          properties: {
            query: { type: "string" },
            max_results: { type: "integer" },
            filters: {
              type: "object",
              properties: {
                source_url: { type: "string", format: "uri" },
                published_after: { type: "string", format: "date" },
              },
              additionalProperties: true,
            },
          },
        };

        const result = normalizeJSONSchemaForOpenAI(input);

        expect(result.required).toEqual(expect.arrayContaining(["query", "max_results", "filters"]));
        expect(result.properties?.filters.required).toEqual(expect.arrayContaining(["source_url", "published_after"]));
        expect(result.properties?.filters.properties?.source_url.format).toBeUndefined(); // uri removed
        expect(result.properties?.filters.properties?.published_after.format).toBe("date"); // date preserved
        expect(result.properties?.filters.additionalProperties).toBe(false); // overridden
      });
    });
  });
});
