/**
 * @file Shared forwarding helpers for gateway surfaces.
 */
import { createProviderBalancer, type ProviderFetch, type ProviderLease, type AcquireOptions } from "./balancer";
import { createBackendResolver } from "./resolver";
import type { GatewayConfig, GatewayBackendConfig } from "./types";
import { errorResponse } from "../../ports/fetch/utils/http";

function createRequestInitFromRequest(request: Request): RequestInit {
  return {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
    redirect: request.redirect,
    keepalive: request.keepalive,
    body: request.body ?? undefined,
  };
}

function formatCapacityHeader(value: number): string {
  return Number.isFinite(value) ? value.toString() : "infinite";
}

function wrapResponse(response: Response, lease: ProviderLease): Response {
  const headers = new Headers(response.headers);
  headers.set("x-gateway-backend", lease.config.id);
  headers.set("x-gateway-active-count", lease.activeCount().toString());
  headers.set("x-gateway-max-concurrency", formatCapacityHeader(lease.maxConcurrency));

  const body = response.body;

  if (!body) {
    lease.release();
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const reader = body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          lease.release();
          controller.close();
          return;
        }

        if (value) {
          controller.enqueue(value);
        }
      } catch (error) {
        lease.release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      lease.release();
      await reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export type ResolveModelResult = {
  attempted: boolean;
  model?: string;
};

export type ResolveModelFn = (request: Request, pathname: string) => Promise<ResolveModelResult>;

/**
 * Builds a forwarding handler that acquires backends and proxies requests.
 */
export function createGatewayForwarder(
  config: GatewayConfig,
  options: {
    fetchFactory: (backend: GatewayBackendConfig) => ProviderFetch;
    resolveModel: ResolveModelFn;
  },
) {
  const balancer = createProviderBalancer(config, options.fetchFactory);
  const resolver = createBackendResolver(config);

  type AcquireOutcome = { readonly kind: "ok"; readonly lease: ProviderLease } | { readonly kind: "error"; readonly response: Response };

  function buildAcquireOptions(resolution: ReturnType<typeof resolver.resolve> | undefined): AcquireOptions {
    return {
      preferredBackendIds: resolution?.preferredBackendIds,
      allowFallback: resolution?.allowFallbackToAny ?? true,
    };
  }

  async function acquireLease(acquireOptions: AcquireOptions): Promise<AcquireOutcome> {
    try {
      const lease = await balancer.acquire(acquireOptions);
      return { kind: "ok", lease };
    } catch (error) {
      if (error instanceof Error && error.name === "GatewayAcquireTimeout") {
        return { kind: "error", response: errorResponse(504, "All upstream backends are busy (acquire timed out)", "gateway_timeout") };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "error", response: errorResponse(503, `Failed to acquire backend: ${message}`, "gateway_unavailable") };
    }
  }

  return async function forward(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const { attempted, model } = await options.resolveModel(request, pathname);

    const resolution = (() => {
      if (model !== undefined) {
        return resolver.resolve(model);
      }
      if (attempted) {
        return resolver.resolve(undefined);
      }
      return undefined;
    })();

    if (attempted) {
      const allowFallback = config.selection?.allowFallbackToAny !== false;
      if (!resolution && !allowFallback) {
        return errorResponse(503, "No backend matched the requested model", "backend_unavailable");
      }
    }

    const acquireOutcome = await acquireLease(buildAcquireOptions(resolution));

    if (acquireOutcome.kind === "error") {
      return acquireOutcome.response;
    }

    const { lease } = acquireOutcome;

    try {
      const response = await lease.handler(request.url, createRequestInitFromRequest(request));
      return wrapResponse(response, lease);
    } catch (error) {
      lease.release();
      return errorResponse(
        502,
        `Upstream ${lease.config.id} request failed: ${error instanceof Error ? error.message : String(error)}`,
        "upstream_error",
      );
    }
  };
}
