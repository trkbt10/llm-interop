/**
 * @file HTTP response and request helpers
 */
export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/**
 * Creates an error response with standard error format
 * @param status - HTTP status code
 * @param message - Error message
 * @param code - Error code (defaults to "bad_request")
 * @returns Response object with error details
 */
export function errorResponse(status: number, message: string, code = "bad_request"): Response {
  return jsonResponse({ error: { message, type: "invalid_request_error", code } }, { status });
}

/**
 * Parse request input into a URL object
 * @param input - RequestInfo or URL to parse
 * @returns URL object
 */
export function parseURL(input: RequestInfo | URL): URL {
  if (typeof input === "string" || input instanceof URL) {
    return new URL(String(input));
  }
  // RequestInfo is a Request object
  return new URL((input as Request).url);
}

/**
 * Type for a fetch-like function that returns a Response
 */
export type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Creates a fetch handler function with URL parsing abstraction
 * Provides a simplified interface where the handler receives a parsed URL and request init
 *
 * @param handler - Function that handles the request with parsed URL
 * @returns Fetch-compatible function
 */
export function createFetchHandler(handler: (url: URL, init?: RequestInit) => Promise<Response>): FetchHandler {
  return async function fetchProxy(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = parseURL(input);
    return handler(url, init);
  };
}
