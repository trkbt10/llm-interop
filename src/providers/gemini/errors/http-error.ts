/**
 * @file Provides HTTP error handling utilities for API responses.
 * Standardizes error creation and response parsing across different provider APIs.
 */

/**
 * Custom error class for HTTP-related errors with additional metadata.
 * Extends the standard Error class to include HTTP status codes and retry information.
 */
// eslint-disable-next-line no-restricted-syntax -- HttpError class extension is intentional
export class HttpError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;

  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (code) {
      this.code = code;
    }
    if (typeof retryAfter === "number" && !Number.isNaN(retryAfter)) {
      this.retryAfter = retryAfter;
    }
  }
}

function normalizeErrorCode(status: number, fallback?: string): string | undefined {
  if (status === 401) {
    return "unauthorized";
  }
  if (status === 403) {
    return "forbidden";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 409) {
    return "conflict";
  }
  if (status === 422) {
    return "unprocessable_entity";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (status >= 500) {
    return "upstream_error";
  }
  if (status >= 400) {
    return "bad_request";
  }
  return fallback;
}

/**
 * Creates an HttpError instance from an HTTP response object.
 * Extracts error details including status code, message, and retry-after headers.
 * @param res - The HTTP response object
 * @param bodyText - Optional response body text to include in error message
 * @param fallbackCode - Optional fallback error code if status doesn't map to a standard code
 * @returns HttpError instance with parsed error information
 */
export function httpErrorFromResponse(res: Response, bodyText?: string, fallbackCode?: string): HttpError {
  const retryAfterHeader = res.headers?.get?.("retry-after");
  const retryAfterNum = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
  const status = res.status ? res.status : 500;
  const statusText = res.statusText ? res.statusText : "";
  const hasBodyText = bodyText ? String(bodyText).trim().length > 0 : false;
  const message = hasBodyText ? `${status} ${statusText}: ${bodyText}`.trim() : `${status} ${statusText}`.trim();
  const code = normalizeErrorCode(status, fallbackCode);
  const validRetryAfter =
    retryAfterNum !== undefined ? (!Number.isNaN(retryAfterNum) ? retryAfterNum : undefined) : undefined;
  return new HttpError(status, message, code, validRetryAfter);
}
