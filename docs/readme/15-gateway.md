# Gateway Surfaces

llm-interop ships a lightweight HTTP gateway that lets you expose the OpenAI, Anthropic, or Gemini API shapes on top of any set of configured providers. It uses the same fetch-based emulation layer that powers the in-process adapters, but adds request routing, backend selection, and concurrency control.

## When to use the gateway

Use the gateway when:

- You need a drop-in HTTP endpoint that existing SDKs or third-party clients can talk to.
- You want to multiplex multiple upstream providers and route traffic per-model (exact match, grade, provider hint, or weighted fallback).
- You prefer a managed Node process instead of embedding the fetch handlers into your application runtime.

If you only need an in-process adapter, keep using the `llm-interop/fetch/*` exports.

## Configuration schema

Gateway configuration reuses the provider definitions defined for the fetch adapters and augments them with routing metadata:

```ts
import type {
  GatewayConfig,
  GatewayBackendConfig,
  GatewaySelectionConfig,
} from "llm-interop/gateway";

const config: GatewayConfig = {
  backends: {
    "primary-openai": {
      id: "primary-openai",
      provider: { type: "openai", apiKey: process.env.OPENAI_KEY },
      weight: 3,
    },
    "claude-backup": {
      id: "claude-backup",
      provider: { type: "claude", apiKey: process.env.CLAUDE_KEY },
      models: { grades: ["high"] },
    },
  },
  selection: {
    priority: ["exact", "grade", "provider"],
    allowFallbackToAny: true,
  } satisfies GatewaySelectionConfig,
};
```

Notes:

- The `backends` map keys have no special semantics; the resolver works with the normalized `id` on each backend.
- `weight` and `maxConcurrency` are optional and control the provider balancer.
- `selection` mirrors the resolver rules in `src/gateway/core/resolver.ts`.

You can author JSON files with the same shape and load them at runtime (see below).

## Programmatic usage

The gateway exports helpers that let you embed the server in any Node process:

```ts
import {
  createGatewaySurface,
  loadGatewayConfigFromFile,
  startGatewayServer,
} from "llm-interop/gateway";

const config = await loadGatewayConfigFromFile("gateway-config.json");

// Start an OpenAI-compatible HTTP server (stream + sync supported).
const instance = await startGatewayServer({
  config,
  surface: "openai",
  server: { port: 8787, host: "0.0.0.0" },
  onListening({ host, port }) {
    console.log(`Gateway ready on http://${host}:${port}`);
  },
});

process.on("SIGTERM", () => {
  void instance.stop().then(() => process.exit(0));
});
```

If you only need the fetch function and already have an HTTP framework, call `createGatewaySurface(surface, config)` to obtain an object exposing `{ fetch }`.

## CLI usage

A convenience CLI is bundled under the workspace script `bin/gateway-server` and exposed via `llm-interop-gateway` after build. It accepts the same options as the programmatic API:

```bash
node dist/bin/gateway-server.js --config ./gateway-config.json --surface openai --port 8787
```

Flags:

- `--config` / `-c`: path to the JSON config (required).
- `--surface`: `openai`, `anthropic`, or `gemini` (default: `openai`).
- `--port`, `--host`, `--strictPort`: runtime server options (strict mode avoids port hopping).

The CLI uses the same internals (`loadGatewayConfigFromFile` and `startGatewayServer`) so behavior matches embedding it yourself.

## Streaming support

Streaming is forwarded end-to-end:

- OpenAI surface returns SSE responses when upstream responses emit async iterables (`responses.create`, `chat.completions.create`).
- Anthropic and Gemini surfaces proxy their native streaming responses the same way.

No extra flags are required; the gateway reuses the streaming support already available in the fetch emulators.

## Mapping rules

Gateway backends are selected using:

1. Exact model matches (from request body, provider model mapping, or backend hints).
2. Grade matches (high/mid/low heuristics via `detectModelGrade`).
3. Provider family hints (`selection.providerHints`).

If none match, the resolver falls back according to `selection.allowFallbackToAny`. The resolver has parity with the in-process fetch helpers, but applies those rules before the request is sent upstream.

Consult `src/gateway/core/resolver.ts` for the precise heuristics if you need to customize routing strategy.
