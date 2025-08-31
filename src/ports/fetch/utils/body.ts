/**
 * @file Body processing utilities for HTTP requests
 */
import { isReadableStream } from "./streams";

/** Normalize body to text */
export async function bodyToText(body: unknown): Promise<string> {
  if (typeof body === "string") {
    return body;
  }
  if (!body) {
    return "";
  }
  if (isReadableStream(body)) {
    return new Response(body as BodyInit).text();
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return new Response(body as BodyInit).text();
  }
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return new Response(body as BodyInit).text();
  }
  if (typeof Uint8Array !== "undefined" && body instanceof Uint8Array) {
    return new Response(body as BodyInit).text();
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return new Response(body as BodyInit).text();
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return new Response(body as BodyInit).text();
  }
  return String(body);
}
