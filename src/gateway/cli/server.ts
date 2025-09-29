/**
 * @file CLI entry for launching llm-interop gateway surfaces.
 */
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { serve, type ServerType } from "@hono/node-server";

import { createGatewayConfig } from "../config/gateway-config";
import type { GatewayConfig } from "../core/types";
import { createAnthropicGateway } from "../surfaces/anthropic";
import { createGeminiGateway } from "../surfaces/gemini";
import { createOpenAIGateway } from "../surfaces/openai";

const DEFAULT_CONFIG = "gateway-config.json";
const FALLBACK_CONFIGS = [DEFAULT_CONFIG, "gateway-config.example.json"];
const DEFAULT_PORT = 8787;
const DEFAULT_SURFACE: GatewaySurface = "openai";

type GatewayApp = ReturnType<typeof createOpenAIGateway>;

type ServerOptions = {
  port?: number;
  host?: string;
  strictPort?: boolean;
};

type GatewaySurface = "openai" | "anthropic" | "gemini";

/**
 * Parses a boolean-like CLI flag value.
 */
function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

/**
 * Parses a numeric CLI argument value.
 */
function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

type CliOptions = {
  configPath: string;
  server: ServerOptions;
  surface: GatewaySurface;
};

type ParsedArgs = {
  options: CliOptions;
  showHelp: boolean;
};

type ParseState = ParsedArgs & { readonly skipNext: number };

/**
 * Transforms raw argv entries into structured CLI options.
 */
function parseArgs(argv: readonly string[]): ParsedArgs {
  const initialState: ParseState = {
    options: { configPath: DEFAULT_CONFIG, server: {}, surface: DEFAULT_SURFACE },
    showHelp: false,
    skipNext: 0,
  };

  const finalState = argv.reduce<ParseState>((state, arg, index, array) => {
    if (state.showHelp) {
      return state;
    }
    if (state.skipNext > 0) {
      return { ...state, skipNext: state.skipNext - 1 };
    }

    if (arg === "--help" || arg === "-h") {
      return { ...state, showHelp: true };
    }

    const next = array[index + 1];

    if (arg === "--config" || arg === "-c") {
      if (next) {
        return {
          options: { ...state.options, configPath: next },
          showHelp: false,
          skipNext: 1,
        };
      }
      return state;
    }
    if (arg.startsWith("--config=")) {
      const [, value] = arg.split("=", 2);
      if (!value) {
        return state;
      }
      return {
        ...state,
        options: { ...state.options, configPath: value },
      };
    }

    if (arg === "--surface") {
      if (next) {
        return {
          options: { ...state.options, surface: normalizeSurface(next, state.options.surface) },
          showHelp: false,
          skipNext: 1,
        };
      }
      return state;
    }
    if (arg.startsWith("--surface=")) {
      const [, value] = arg.split("=", 2);
      if (!value) {
        return state;
      }
      return {
        ...state,
        options: { ...state.options, surface: normalizeSurface(value, state.options.surface) },
      };
    }

    const nextNumber = parseNumber(next);
    const [, inlineValue] = arg.split("=", 2);

    const updateServer = (patch: Partial<ServerOptions>, skipNext: number): ParseState => ({
      options: { ...state.options, server: { ...state.options.server, ...patch } },
      showHelp: false,
      skipNext,
    });

    if (arg === "--port" || arg === "-p") {
      if (nextNumber === undefined) {
        return state;
      }
      return updateServer({ port: nextNumber }, 1);
    }
    if (arg.startsWith("--port=")) {
      const parsed = parseNumber(inlineValue);
      if (parsed === undefined) {
        return state;
      }
      return updateServer({ port: parsed }, 0);
    }

    if (arg === "--host") {
      if (!next) {
        return state;
      }
      return updateServer({ host: next }, 1);
    }
    if (arg.startsWith("--host=") && inlineValue) {
      return updateServer({ host: inlineValue }, 0);
    }

    if (arg === "--strictPort") {
      return updateServer({ strictPort: true }, 0);
    }
    if (arg.startsWith("--strictPort=")) {
      const parsed = parseBoolean(inlineValue, true);
      return updateServer({ strictPort: parsed }, 0);
    }

    if (arg.startsWith("--server.")) {
      const [rawKey, rawExplicit] = arg.slice("--server.".length).split("=", 2);
      if (!rawKey) {
        return state;
      }
      const key = rawKey.trim();
      const value = rawExplicit ?? next;
      const shouldSkip = rawExplicit === undefined && value !== undefined && !arg.includes("=");
      const nextSkip = Number(shouldSkip);

      if (key === "port") {
        const parsed = parseNumber(value);
        if (parsed === undefined) {
          return state;
        }
        return updateServer({ port: parsed }, nextSkip);
      }
      if (key === "host") {
        if (!value) {
          return state;
        }
        return updateServer({ host: value }, nextSkip);
      }
      if (key === "strictPort") {
        return updateServer({ strictPort: parseBoolean(value, true) }, nextSkip);
      }
    }

    return state;
  }, initialState);

  return { options: finalState.options, showHelp: finalState.showHelp };
}

function printHelp(): void {
  const lines = [
    "Usage: llm-interop-gateway [options]",
    "",
    "Options:",
    "  -c, --config <path>            Path to gateway config JSON (default: gateway-config.json)",
    "      --surface <kind>          Gateway surface to expose (openai | anthropic | gemini)",
    "  -p, --port <number>            Port to listen on",
    "      --host <host>              Hostname to bind (default: 0.0.0.0)",
    "      --strictPort               Fail instead of trying the next port when busy",
    "      --server.port <number>     Same as --port",
    "      --server.host <host>       Same as --host",
    "      --server.strictPort        Same as --strictPort",
    "  -h, --help                     Show this help message",
  ];
  console.log(lines.join("\n"));
}

/**
 * Loads the gateway configuration from the first available candidate path.
 */
async function loadConfig(configPath: string) {
  const uniqueCandidates = new Set<string>([configPath, ...FALLBACK_CONFIGS]);
  const candidates = Array.from(uniqueCandidates);

  const loadSequentially = async (
    remaining: readonly string[],
    tried: readonly string[],
    lastError?: unknown,
  ): Promise<GatewayConfig> => {
    if (remaining.length === 0) {
      const extra = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
      throw new Error(`Unable to locate gateway config. Tried: ${tried.join(", ")}.${extra}`);
    }

    const [candidate, ...rest] = remaining;
    const resolved = path.resolve(process.cwd(), candidate);

    try {
      const raw = await readFile(resolved, "utf8");
      const parsed = JSON.parse(raw);
      return createGatewayConfig(parsed);
    } catch (error) {
      const code = typeof error === "object" && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
      if (code === "ENOENT") {
        return loadSequentially(rest, [...tried, resolved], error);
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load config from ${resolved}: ${reason}`);
    }
  };

  return loadSequentially(candidates, []);
}

/**
 * Resolves once the provided HTTP server enters the listening state.
 */
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

/**
 * Starts the HTTP gateway server with optional port retries.
 */
async function startServer(
  app: GatewayApp,
  options: ServerOptions,
): Promise<{ server: ServerType; port: number; host: string }> {
  const host = options.host ?? "0.0.0.0";
  const strict = options.strictPort ?? false;
  const startingPort = options.port ?? DEFAULT_PORT;
  const maxAttempts = strict ? 1 : 10;

  const handleListen = ({ address, port }: AddressInfo) => {
    const hostname = (() => {
      if (typeof address === "string" && address !== "::") {
        return address;
      }
      return "0.0.0.0";
    })();
    console.log(`⚙️  Gateway listening on http://${hostname}:${port}`);
  };

  const attemptStart = async (offset: number, lastError?: unknown): Promise<{ server: ServerType; port: number; host: string }> => {
    if (offset >= maxAttempts) {
      if (lastError) {
        throw lastError;
      }
      throw new Error(`Unable to start server after ${maxAttempts} attempts.`);
    }

    const port = startingPort + offset;

    try {
      const server = serve({ fetch: app.fetch, port, hostname: host }, handleListen);
      await onceListening(server).catch((error) => {
        server.close();
        throw error;
      });
      return { server, port, host };
    } catch (error) {
      const code = typeof error === "object" && error !== null ? (error as NodeJS.ErrnoException).code : undefined;
      if (code === "EADDRINUSE" && !strict) {
        console.warn(`Port ${port} is in use. Trying ${port + 1}...`);
        return attemptStart(offset + 1, error);
      }
      throw error;
    }
  };

  return attemptStart(0);
}

/**
 * Normalizes the requested gateway surface identifier.
 */
function normalizeSurface(value: string, fallback: GatewaySurface): GatewaySurface {
  const normalized = value.trim().toLowerCase();
  if (normalized === "openai" || normalized === "anthropic" || normalized === "gemini") {
    return normalized;
  }
  console.warn(`Unknown surface '${value}', falling back to '${fallback}'.`);
  return fallback;
}

/**
 * Constructs the Hono app for a specific gateway surface.
 */
async function buildGateway(surface: GatewaySurface, config: GatewayConfig): Promise<GatewayApp> {
  switch (surface) {
    case "openai":
      return createOpenAIGateway(config);
    case "anthropic":
      return createAnthropicGateway(config);
    case "gemini":
      return createGeminiGateway(config);
    default:
      throw new Error(`Unsupported gateway surface: ${surface}`);
  }
}

/**
 * CLI entry point.
 */
export async function main() {
  const { options, showHelp } = parseArgs(process.argv.slice(2));

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  try {
    const config = await loadConfig(options.configPath);
    const app = await buildGateway(options.surface, config);

    const { server, port, host } = await startServer(app, options.server);
    console.log(`Gateway (${options.surface}) ready at http://${host}:${port}`);

    const shutdown = (signal: NodeJS.Signals) => {
      console.log(`\nReceived ${signal}. Shutting down gateway...`);
      server.close(() => {
        process.exit(0);
      });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    console.log("Press Ctrl+C to stop the gateway.");
  } catch (error) {
    console.error("Failed to start gateway server:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const entryFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === entryFilePath) {
  void main();
}
