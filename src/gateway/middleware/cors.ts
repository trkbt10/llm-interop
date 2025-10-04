/**
 * @file CORS middleware for gateway servers.
 */
import type { GatewayServerRuntimeOptions } from "../core/types";

type CorsConfig = NonNullable<GatewayServerRuntimeOptions["cors"]>;
type CorsOptions = Exclude<CorsConfig, boolean>;

/**
 * Type guard to check if CORS config is an object.
 */
function isCorsOptions(config: CorsConfig): config is CorsOptions {
  return typeof config === "object";
}

/**
 * Creates CORS headers based on configuration.
 */
function createCorsHeaders(config: CorsConfig, origin: string | null): Headers {
  const headers = new Headers();

  if (config === true) {
    // Allow all origins
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return headers;
  }

  // Type guard ensures TypeScript knows config is CorsOptions
  if (!isCorsOptions(config)) {
    return headers;
  }

  const corsOptions = config;

  // Handle origin
  if (corsOptions.origin !== undefined) {
    if (typeof corsOptions.origin === "string") {
      headers.set("Access-Control-Allow-Origin", corsOptions.origin);
    } else if (Array.isArray(corsOptions.origin)) {
      if (origin && corsOptions.origin.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
      }
    } else if (typeof corsOptions.origin === "function") {
      if (origin && corsOptions.origin(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
      }
    }
  } else if (origin) {
    // Default: reflect the request origin
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  // Handle methods
  if (corsOptions.methods) {
    headers.set("Access-Control-Allow-Methods", corsOptions.methods.join(", "));
  } else {
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  }

  // Handle allowed headers
  if (corsOptions.allowedHeaders) {
    headers.set("Access-Control-Allow-Headers", corsOptions.allowedHeaders.join(", "));
  } else {
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // Handle exposed headers
  if (corsOptions.exposedHeaders) {
    headers.set("Access-Control-Expose-Headers", corsOptions.exposedHeaders.join(", "));
  }

  // Handle credentials
  if (corsOptions.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Handle max age
  if (corsOptions.maxAge !== undefined) {
    headers.set("Access-Control-Max-Age", corsOptions.maxAge.toString());
  }

  return headers;
}

/**
 * Wraps a fetch handler with CORS support.
 */
export function withCors(
  handler: (request: Request) => Promise<Response> | Response,
  corsConfig?: CorsConfig,
): (request: Request) => Promise<Response> {
  if (!corsConfig) {
    return async (request: Request) => handler(request);
  }

  return async (request: Request) => {
    const origin = request.headers.get("Origin");

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      const corsHeaders = createCorsHeaders(corsConfig, origin);
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Handle actual requests
    const response = await handler(request);
    const corsHeaders = createCorsHeaders(corsConfig, origin);

    // Merge CORS headers with response headers
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of corsHeaders.entries()) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
