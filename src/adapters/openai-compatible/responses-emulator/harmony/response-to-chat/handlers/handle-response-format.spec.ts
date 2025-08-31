/**
 * @file Tests for response format handling.
 */
import { handleResponseFormat } from "./handle-response-format";
import type { ResponseTextConfig } from "../../types";
import { createResponseTextConfig } from "../../fixtures.test.support";

describe("handleResponseFormat", () => {
  it("should return null when no text config provided", () => {
    expect(handleResponseFormat()).toBeUndefined();
  });

  it("should return null when text config has no response_format", () => {
    const text: ResponseTextConfig = {} as ResponseTextConfig;
    expect(handleResponseFormat(text)).toBeUndefined();
  });

  it("should return null when response_format type is not json_schema", () => {
    const text: ResponseTextConfig = {
      response_format: { type: "text" },
    } as ResponseTextConfig;
    expect(handleResponseFormat(text)).toBeUndefined();
  });

  it("should format response with name and schema", () => {
    const text = createResponseTextConfig("shopping_list", {
      properties: {
        items: { type: "array", items: { type: "string" } },
      },
      type: "object",
    });

    const result = handleResponseFormat(text);
    expect(result).toContain("# Response Formats");
    expect(result).toContain("## shopping_list");
    expect(result).toContain('{"properties":{"items":{"type":"array","items":{"type":"string"}}},"type":"object"}');
  });

  it("should include description when provided", () => {
    const text = createResponseTextConfig("shopping_list", { type: "object" }, "A list of items to purchase");

    const result = handleResponseFormat(text);
    expect(result).toContain("// A list of items to purchase");
  });

  it("should return null when missing required fields", () => {
    // Missing name
    const text1: ResponseTextConfig = {
      response_format: {
        type: "json_schema",
        json_schema: {
          schema: { type: "object" },
        },
      },
    } as ResponseTextConfig;
    expect(handleResponseFormat(text1)).toBeUndefined();

    // Missing schema
    const text2: ResponseTextConfig = {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test",
        },
      },
    } as ResponseTextConfig;
    expect(handleResponseFormat(text2)).toBeUndefined();
  });
});
