/**
 * @file Public entry point for gateway utilities.
 */
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import process from "node:process";
import { serve, type ServerType } from "@hono/node-server";

import { createGatewayConfig as createGatewayConfigInternal } from "./config/gateway-config";
import { summarizeGatewayConfig as summarizeGatewayConfigInternal } from "./config/gateway-summary";
import { createOpenAIGateway as createOpenAIGatewayInternal } from "./surfaces/openai";
import { createAnthropicGateway as createAnthropicGatewayInternal } from "./surfaces/anthropic";
import { createGeminiGateway as createGeminiGatewayInternal } from "./surfaces/gemini";

export type { GatewayConfigSummary } from "./config/gateway-summary";

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "0.0.0.0";

export type GatewayModelGrade = "high" | "mid" | "low";

export type GatewayProviderModelMapping = {
  byGrade?: Partial<Record<GatewayModelGrade, string>>;
  aliases?: Record<string, string>;
};

export type GatewayProviderApiConfig = {
  keyByModelPrefix?: Record<string, string>;
};

export type GatewayProviderOpenAICompat = {
  transformHarmony?: boolean;
  emulateResponsesWithChat?: boolean;
  preferResponsesAPI?: boolean;
  autoFallbackToEmulator?: boolean;
};

export type GatewayProviderCodingAgent = {
  kind?: string;
  binPath: string;
  args?: string[];
  produces?: "json" | "jsonl" | "text";
};

export type GatewayProviderType = "openai" | "claude" | "gemini" | (string & {});

export type GatewayProviderConfig = {
  type: GatewayProviderType;
  model?: string;
  modelMapping?: GatewayProviderModelMapping;
  baseURL?: string;
  apiKey?: string;
  defaultHeaders?: Record<string, string>;
  api?: GatewayProviderApiConfig;
  openaiCompat?: GatewayProviderOpenAICompat;
  codingAgent?: GatewayProviderCodingAgent;
};

export type GatewayBackendModelsConfig = {
  exact?: string[];
  grades?: GatewayModelGrade[];
};

export type GatewayBackendConfig = {
  id: string;
  provider: GatewayProviderConfig;
  weight?: number;
  maxConcurrency?: number;
  models?: GatewayBackendModelsConfig;
};

export type GatewayRoutingConfig = {
  acquireTimeoutMs?: number;
};

export type GatewaySelectionRule = "exact" | "grade" | "provider";

export type GatewaySelectionConfig = {
  priority?: GatewaySelectionRule[];
  allowFallbackToAny?: boolean;
  providerHints?: Record<string, string[]>;
};

export type GatewayConfig = {
  backends: Record<string, GatewayBackendConfig>;
  routing?: GatewayRoutingConfig;
  selection?: GatewaySelectionConfig;
  server?: GatewayServerRuntimeOptions;
};

export type GatewayConfigInput = {
  backends: GatewayBackendConfig[];
  routing?: GatewayRoutingConfig;
  selection?: GatewaySelectionConfig;
  server?: GatewayServerRuntimeOptions;
};

export type GatewaySurface = "openai" | "anthropic" | "gemini";

export type GatewayServerRuntimeOptions = {
  port?: number;
  host?: string;
  strictPort?: boolean;
};

export type StartGatewayServerOptions = {
  config: GatewayConfig | GatewayConfigInput;
  surface: GatewaySurface;
  server?: GatewayServerRuntimeOptions;
  onListening?: (info: { host: string; port: number; surface: GatewaySurface; server: ServerType }) => void;
  onPortRetry?: (info: { attemptedPort: number; nextPort: number; error: unknown }) => void;
};

export type GatewayServerInstance = {
  surface: GatewaySurface;
  app: GatewayApplication;
  server: ServerType;
  host: string;
  port: number;
  stop(): Promise<void>;
};

export type GatewayApplication = ReturnType<typeof createOpenAIGatewayInternal>;

type InternalGatewayConfig = ReturnType<typeof createGatewayConfigInternal>;
type InternalGatewayConfigInput = Parameters<typeof createGatewayConfigInternal>[0];

function isNormalizedGatewayConfig(
  config: GatewayConfig | GatewayConfigInput,
): config is GatewayConfig & InternalGatewayConfig {
  return !Array.isArray((config as GatewayConfigInput).backends);
}

function normalizeGatewayConfig(config: GatewayConfig | GatewayConfigInput): InternalGatewayConfig {
  if (isNormalizedGatewayConfig(config)) {
    return config;
  }
  return createGatewayConfigInternal(config as InternalGatewayConfigInput);
}

function resolveSurface(surface: GatewaySurface, config: GatewayConfig | GatewayConfigInput): GatewayApplication {
  const normalized = normalizeGatewayConfig(config);
  switch (surface) {
    case "openai":
      return createOpenAIGatewayInternal(normalized);
    case "anthropic":
      return createAnthropicGatewayInternal(normalized);
    case "gemini":
      return createGeminiGatewayInternal(normalized);
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unsupported gateway surface: ${exhaustive}`);
    }
  }
}

function toListeningHost(address: AddressInfo["address"], fallback: string): string {
  if (typeof address === "string" && address !== "::") {
    return address;
  }
  return fallback;
}

async function onceListening(server: ServerType): Promise<void> {
  if (server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const onError = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      server.off("error", onError);
      server.off("listening", onListening);
    };
    server.once("error", onError);
    server.once("listening", onListening);
  });
}

async function waitForListeningOrClose(server: ServerType): Promise<void> {
  try {
    await onceListening(server);
  } catch (error) {
    server.close();
    throw error;
  }
}

/**
 * Loads a gateway configuration JSON file.
 */
export async function loadGatewayConfigFromFile(configPath: string): Promise<GatewayConfig> {
  const cwd = process.cwd();
  const resolved = path.resolve(cwd, configPath);

  try {
    const raw = await readFile(resolved, "utf8");
    const parsed = JSON.parse(raw) as GatewayConfigInput;
    return createGatewayConfigInternal(parsed as InternalGatewayConfigInput);
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      const exampleConfig: GatewayConfigInput = {
        backends: [
          {
            id: "provider-1",
            provider: {
              type: "openai",
              apiKey: "${YOUR_API_KEY}",
              model: "llm-name"
            },
            weight: 1
          }
        ]
      };

      throw new Error(
        `Gateway config not found.\n\n` +
        `Search strategy:\n` +
        `  1. Given path: ${configPath}\n` +
        `  2. Resolved from working directory: ${cwd}\n` +
        `  3. Final path checked: ${resolved}\n\n` +
        `Create a gateway-config.json file with the following structure:\n` +
        JSON.stringify(exampleConfig, null, 2) +
        `\n\nSee gateway-config.example.json for a complete example.`
      );
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config from ${resolved}: ${reason}`);
  }
}

/**
 * Generates a human-readable summary of the gateway configuration.
 */
export function summarizeGatewayConfig(config: GatewayConfig | GatewayConfigInput) {
  return summarizeGatewayConfigInternal(config);
}

/**
 * Creates a Hono application for a gateway surface.
 */
export function createGatewaySurface(
  surface: GatewaySurface,
  config: GatewayConfig | GatewayConfigInput,
): GatewayApplication {
  return resolveSurface(surface, config);
}

/**
 * Starts a gateway HTTP server for a specific surface.
 */
export async function startGatewayServer(options: StartGatewayServerOptions): Promise<GatewayServerInstance> {
  const app = resolveSurface(options.surface, options.config);
  const host = options.server?.host ?? DEFAULT_HOST;
  const strict = options.server?.strictPort ?? true;
  const startingPort = options.server?.port ?? DEFAULT_PORT;
  const maxAttempts = strict ? 1 : 10;

  const attemptStart = async (
    offset: number,
    lastError?: unknown,
  ): Promise<GatewayServerInstance> => {
    if (offset >= maxAttempts) {
      if (lastError) {
        throw lastError;
      }
      throw new Error(`Unable to start server after ${maxAttempts} attempts.`);
    }

    const port = startingPort + offset;
    const listeningState = { host };

    try {
      const server = serve(
        { fetch: app.fetch, port, hostname: host },
        ({ address, port: listeningPort }: AddressInfo) => {
          const resolvedHost = toListeningHost(address, host);
          listeningState.host = resolvedHost;
          options.onListening?.({ host: resolvedHost, port: listeningPort, surface: options.surface, server });
        },
      );
      await waitForListeningOrClose(server);

      const instance: GatewayServerInstance = {
        surface: options.surface,
        app,
        server,
        host: listeningState.host,
        port,
        async stop() {
          await new Promise<void>((resolve, reject) => {
            server.close((closeError?: Error) => {
              if (closeError) {
                reject(closeError);
                return;
              }
              resolve();
            });
          });
        },
      };
      return instance;
    } catch (error) {
      const code = typeof error === "object" && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
      if (code === "EADDRINUSE" && !strict) {
        const nextPort = port + 1;
        options.onPortRetry?.({ attemptedPort: port, nextPort, error });
        return attemptStart(offset + 1, error);
      }
      throw error;
    }
  };

  return attemptStart(0);
}
