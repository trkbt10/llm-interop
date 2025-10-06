/**
 * @file CLI entry for launching llm-interop gateway surfaces.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  loadGatewayConfigFromFile,
  startGatewayServer,
  summarizeGatewayConfig,
  type GatewaySurface,
  type GatewayServerRuntimeOptions,
  type GatewayConfig,
} from "..";

const DEFAULT_CONFIG = "gateway-config.json";
const DEFAULT_SURFACE: GatewaySurface = "openai";

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
  server: GatewayServerRuntimeOptions;
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
    options: { configPath: DEFAULT_CONFIG, server: { strictPort: true }, surface: DEFAULT_SURFACE },
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
          options: { ...state.options, surface: parseSurface(next) },
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
        options: { ...state.options, surface: parseSurface(value) },
      };
    }

    const nextNumber = parseNumber(next);
    const [, inlineValue] = arg.split("=", 2);

    const updateServer = (patch: Partial<GatewayServerRuntimeOptions>, skipNext: number): ParseState => ({
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
      if (key === "logging.enabled") {
        const logging = state.options.server.logging ?? {};
        return updateServer({ logging: { ...logging, enabled: parseBoolean(value, true) } }, nextSkip);
      }
      if (key === "logging.level") {
        if (!value || !["debug", "info", "warn", "error"].includes(value)) {
          return state;
        }
        const logging = state.options.server.logging ?? {};
        return updateServer({ logging: { ...logging, level: value as "debug" | "info" | "warn" | "error" } }, nextSkip);
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
    "  -c, --config <path>                Path to gateway config JSON (default: gateway-config.json)",
    "      --surface <kind>               Gateway surface to expose (openai | anthropic | gemini)",
    "  -p, --port <number>                Port to listen on",
    "      --host <host>                  Hostname to bind (default: 0.0.0.0)",
    "      --strictPort                   Fail instead of trying the next port when busy (default: true)",
    "      --server.port <number>         Same as --port",
    "      --server.host <host>           Same as --host",
    "      --server.strictPort            Same as --strictPort",
    "      --server.logging.enabled       Enable/disable request logging (default: true)",
    "      --server.logging.level <level> Set log level (debug | info | warn | error, default: info)",
    "  -h, --help                         Show this help message",
  ];
  console.log(lines.join("\n"));
}

/**
 * Validates the requested gateway surface identifier.
 */
function parseSurface(value: string): GatewaySurface {
  const normalized = value.trim().toLowerCase();
  if (normalized === "openai" || normalized === "anthropic" || normalized === "gemini") {
    return normalized;
  }
  throw new Error(`Unsupported gateway surface: ${value}`);
}

/**
 * Prints a formatted summary of the gateway configuration.
 */
function printConfigSummary(config: GatewayConfig, surface: GatewaySurface): void {
  const summary = summarizeGatewayConfig(config);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚪 Gateway Configuration Summary`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Surface: ${surface}`);
  console.log(`Backends: ${summary.totalBackends} configured\n`);

  for (const backend of summary.backends) {
    console.log(`  ├─ ${backend.id}`);
    console.log(`  │  Provider: ${backend.provider}${backend.model ? ` (${backend.model})` : ""}`);
    if (backend.weight !== undefined) {
      console.log(`  │  Weight: ${backend.weight}`);
    }
    if (backend.maxConcurrency !== undefined) {
      console.log(`  │  Max Concurrency: ${backend.maxConcurrency}`);
    }
    if (backend.supportedModels.exact.length > 0) {
      console.log(`  │  Exact Models: ${backend.supportedModels.exact.join(", ")}`);
    }
    if (backend.supportedModels.grades.length > 0) {
      console.log(`  │  Grades: ${backend.supportedModels.grades.join(", ")}`);
    }
    console.log("");
  }

  if (summary.routing?.acquireTimeoutMs) {
    console.log(`Routing:`);
    console.log(`  Acquire Timeout: ${summary.routing.acquireTimeoutMs}ms\n`);
  }

  if (summary.selection) {
    console.log(`Selection:`);
    if (summary.selection.priority) {
      console.log(`  Priority: ${summary.selection.priority.join(" → ")}`);
    }
    if (summary.selection.allowFallbackToAny !== undefined) {
      console.log(`  Allow Fallback: ${summary.selection.allowFallbackToAny}`);
    }
    if (summary.selection.providerHints && Object.keys(summary.selection.providerHints).length > 0) {
      console.log(`  Provider Hints:`);
      for (const [provider, backends] of Object.entries(summary.selection.providerHints)) {
        console.log(`    ${provider}: ${backends.join(", ")}`);
      }
    }
    console.log("");
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

/**
 * CLI entry point.
 */
export async function main() {
  const { options, showHelp } = (() => {
    try {
      return parseArgs(process.argv.slice(2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  })();

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  try {
    const config = await loadGatewayConfigFromFile(options.configPath);

    printConfigSummary(config, options.surface);

    // Merge server config from file and CLI args (CLI args take precedence)
    const serverConfig: GatewayServerRuntimeOptions = {
      ...config.server,
      ...options.server,
    };

    const instance = await startGatewayServer({
      config,
      surface: options.surface,
      server: serverConfig,
      onListening: ({ host, port }) => {
        console.log(`⚙️  Gateway listening on http://${host}:${port}`);
      },
      onPortRetry: ({ attemptedPort, nextPort }) => {
        console.warn(`Port ${attemptedPort} is in use. Trying ${nextPort}...`);
      },
    });

    console.log(`✅ Gateway ready at http://${instance.host}:${instance.port}`);

    const shutdown = (signal: NodeJS.Signals) => {
      console.log(`\nReceived ${signal}. Shutting down gateway...`);
      void instance
        .stop()
        .then(() => {
          process.exit(0);
        })
        .catch((stopError) => {
          console.error("Failed to shut down cleanly:", stopError instanceof Error ? stopError.message : stopError);
          process.exit(1);
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
