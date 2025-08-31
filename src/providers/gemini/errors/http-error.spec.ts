/**
 * @file Tests for HTTP error utilities
 */
import { HttpError, httpErrorFromResponse } from "./http-error";

describe("HTTP Error Utilities", () => {
  describe("HttpError class", () => {
    it("should create basic error with status and message", () => {
      const error = new HttpError(404, "Not found");

      expect(error.name).toBe("HttpError");
      expect(error.status).toBe(404);
      expect(error.message).toBe("Not found");
      expect(error.code).toBeUndefined();
      expect(error.retryAfter).toBeUndefined();
    });

    it("should create error with optional code", () => {
      const error = new HttpError(401, "Unauthorized", "auth_failed");

      expect(error.status).toBe(401);
      expect(error.message).toBe("Unauthorized");
      expect(error.code).toBe("auth_failed");
      expect(error.retryAfter).toBeUndefined();
    });

    it("should create error with retry-after value", () => {
      const error = new HttpError(429, "Rate limited", "rate_limit", 60);

      expect(error.status).toBe(429);
      expect(error.message).toBe("Rate limited");
      expect(error.code).toBe("rate_limit");
      expect(error.retryAfter).toBe(60);
    });

    it("should handle invalid retry-after values", () => {
      const errorNaN = new HttpError(500, "Error", "server_error", NaN);
      expect(errorNaN.retryAfter).toBeUndefined();

      // Infinity is a valid number (not NaN), so it gets set
      const errorInfinity = new HttpError(500, "Error", "server_error", Infinity);
      expect(errorInfinity.retryAfter).toBe(Infinity);

      const errorNegative = new HttpError(500, "Error", "server_error", -1);
      expect(errorNegative.retryAfter).toBe(-1); // Negative numbers are allowed
    });

    it("should extend Error correctly", () => {
      const error = new HttpError(500, "Internal error");

      expect(error instanceof Error).toBe(true);
      expect(error instanceof HttpError).toBe(true);
      expect(error.stack).toBeDefined();
    });
  });

  describe("httpErrorFromResponse", () => {
    // Mock Response object factory
    type HeaderRecord = Record<string, string>;
    type ResponseOverrides = Partial<Pick<Response, "status" | "statusText" | "url">> & { headers?: HeaderRecord };
    const mockResponse = (overrides: ResponseOverrides = {}): Response => {
      const mockHeaders = new Headers();
      if (overrides.headers) {
        Object.entries(overrides.headers).forEach(([key, value]) => {
          mockHeaders.set(key, value);
        });
      }

      // Extract headers from overrides before spreading to avoid overwriting mockHeaders
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- headers is extracted to avoid conflict with mockHeaders
      const { headers, ...restOverrides } = overrides;

      const base: Partial<Response> = {
        status: overrides.status ?? 500,
        statusText: overrides.statusText ?? "Internal Server Error",
        headers: mockHeaders,
        ok: (overrides.status ?? 500) >= 200 && (overrides.status ?? 500) < 300,
        ...restOverrides,
      };
      return base as Response;
    };

    describe("Status code mapping", () => {
      const statusMappings = [
        { status: 401, expectedCode: "unauthorized" },
        { status: 403, expectedCode: "forbidden" },
        { status: 404, expectedCode: "not_found" },
        { status: 409, expectedCode: "conflict" },
        { status: 422, expectedCode: "unprocessable_entity" },
        { status: 429, expectedCode: "rate_limited" },
        { status: 500, expectedCode: "upstream_error" },
        { status: 502, expectedCode: "upstream_error" },
        { status: 503, expectedCode: "upstream_error" },
        { status: 400, expectedCode: "bad_request" },
        { status: 418, expectedCode: "bad_request" }, // I'm a teapot -> bad_request
      ];

      statusMappings.forEach(({ status, expectedCode }) => {
        it(`should map status ${status} to code '${expectedCode}'`, () => {
          const response = mockResponse({ status, statusText: "Test error" });
          const error = httpErrorFromResponse(response);

          expect(error.status).toBe(status);
          expect(error.code).toBe(expectedCode);
        });
      });

      it("should use fallback code for unmapped status", () => {
        const response = mockResponse({ status: 200, statusText: "OK" });
        const error = httpErrorFromResponse(response, undefined, "custom_fallback");

        expect(error.status).toBe(200);
        expect(error.code).toBe("custom_fallback");
      });

      it("should return undefined code for unmapped status without fallback", () => {
        const response = mockResponse({ status: 200, statusText: "OK" });
        const error = httpErrorFromResponse(response);

        expect(error.status).toBe(200);
        expect(error.code).toBeUndefined();
      });
    });

    describe("Retry-After header parsing", () => {
      it("should parse retry-after header correctly", () => {
        const headers = { "retry-after": "120" };
        const response = mockResponse({ status: 429, headers });
        const error = httpErrorFromResponse(response);

        expect(error.retryAfter).toBe(120);
      });

      it("should handle invalid retry-after header", () => {
        const headers = { "retry-after": "invalid" };
        const response = mockResponse({ status: 429, headers });
        const error = httpErrorFromResponse(response);

        expect(error.retryAfter).toBeUndefined();
      });

      it("should handle missing retry-after header", () => {
        const response = mockResponse({ status: 429 });
        const error = httpErrorFromResponse(response);

        expect(error.retryAfter).toBeUndefined();
      });

      it("should handle zero retry-after value", () => {
        const headers = { "retry-after": "0" };
        const response = mockResponse({ status: 429, headers });
        const error = httpErrorFromResponse(response);

        expect(error.retryAfter).toBe(0);
      });
    });

    describe("Message formatting", () => {
      it("should format message with status and statusText", () => {
        const response = mockResponse({ status: 404, statusText: "Not Found" });
        const error = httpErrorFromResponse(response);

        expect(error.message).toBe("404 Not Found");
      });

      it("should include body text when provided", () => {
        const response = mockResponse({ status: 400, statusText: "Bad Request" });
        const error = httpErrorFromResponse(response, "Invalid parameter: model");

        expect(error.message).toBe("400 Bad Request: Invalid parameter: model");
      });

      it("should handle empty body text", () => {
        const response = mockResponse({ status: 500, statusText: "Internal Server Error" });
        const error = httpErrorFromResponse(response, "");

        expect(error.message).toBe("500 Internal Server Error");
      });

      it("should handle whitespace-only body text", () => {
        const response = mockResponse({ status: 500, statusText: "Internal Server Error" });
        const error = httpErrorFromResponse(response, "   \n  \t  ");

        expect(error.message).toBe("500 Internal Server Error");
      });

      it("should handle missing statusText", () => {
        const response = mockResponse({ status: 500, statusText: "" });
        const error = httpErrorFromResponse(response);

        expect(error.message).toBe("500");
      });

      it("should handle very long body text", () => {
        const longBody = "Error: " + "a".repeat(10000);
        const response = mockResponse({ status: 400, statusText: "Bad Request" });
        const error = httpErrorFromResponse(response, longBody);

        expect(error.message).toBe(`400 Bad Request: ${longBody}`);
      });
    });

    describe("Edge cases", () => {
      it("should handle response without status property", () => {
        const response = mockResponse();
        const responseObj = response as { status?: unknown };
        delete responseObj.status;
        const error = httpErrorFromResponse(response);

        expect(error.status).toBe(500); // fallback
      });

      it("should handle response with null status", () => {
        const response = mockResponse({ status: undefined });
        const error = httpErrorFromResponse(response);

        expect(error.status).toBe(500); // fallback
      });

      it("should handle response without headers", () => {
        const response = mockResponse();
        const responseObj2 = response as { headers?: unknown };
        delete responseObj2.headers;
        const error = httpErrorFromResponse(response);

        expect(error.retryAfter).toBeUndefined();
        expect(error.status).toBe(500);
      });

      it("should handle response with malformed headers", () => {
        const response = mockResponse();
        const responseObj3 = response as { headers?: unknown };
        responseObj3.headers = { get: null };
        const error = httpErrorFromResponse(response);

        expect(error.retryAfter).toBeUndefined();
      });
    });

    describe("Real-world scenarios", () => {
      it("should handle OpenAI rate limit response", () => {
        const response = mockResponse({
          status: 429,
          statusText: "Too Many Requests",
          headers: { "retry-after": "60" },
        });
        const bodyText = JSON.stringify({
          error: {
            message: "Rate limit reached for requests",
            type: "requests",
          },
        });
        const error = httpErrorFromResponse(response, bodyText);

        expect(error.status).toBe(429);
        expect(error.code).toBe("rate_limited");
        expect(error.retryAfter).toBe(60);
        expect(error.message).toContain("Rate limit reached");
      });

      it("should handle Claude authentication error", () => {
        const response = mockResponse({
          status: 401,
          statusText: "Unauthorized",
        });
        const bodyText = JSON.stringify({
          type: "error",
          error: {
            type: "authentication_error",
            message: "Invalid API key",
          },
        });
        const error = httpErrorFromResponse(response, bodyText);

        expect(error.status).toBe(401);
        expect(error.code).toBe("unauthorized");
        expect(error.message).toContain("Invalid API key");
      });

      it("should handle Gemini service unavailable", () => {
        const response = mockResponse({
          status: 503,
          statusText: "Service Unavailable",
        });
        const error = httpErrorFromResponse(response, "Service temporarily unavailable");

        expect(error.status).toBe(503);
        expect(error.code).toBe("upstream_error");
        expect(error.message).toBe("503 Service Unavailable: Service temporarily unavailable");
      });
    });
  });
});
