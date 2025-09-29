/**
 * @file Vite build configuration
 */

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL("./", import.meta.url));
const CLI_ENTRY = path.resolve(ROOT_DIR, "src/gateway/cli/server.ts");

function noNodeBuiltins() {
  const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
  return {
    name: "no-node-builtins",
    resolveId(id: string, importer?: string) {
      if (importer && path.resolve(importer) === CLI_ENTRY) {
        return null;
      }
      const base = id.replace(/^node:/, "").split("/", 1)[0];
      if (builtins.has(id) || builtins.has(base)) {
        const from = importer ? ` imported from ${importer}` : "";
        throw new Error(`[no-node-builtins] Detected Node builtin import: '${id}'${from}`);
      }
      return null;
    },
  } as const;
}

function cliShebang() {
  return {
    name: "cli-shebang",
    renderChunk(code: string, chunk: { facadeModuleId?: string | null }) {
      if (!chunk.facadeModuleId) {
        return null;
      }
      if (path.resolve(chunk.facadeModuleId) !== CLI_ENTRY) {
        return null;
      }
      return {
        code: `#!/usr/bin/env node\n${code}`,
        map: null,
      };
    },
  } as const;
}

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      outDir: "dist",
      insertTypesEntry: true,
      tsconfigPath: "tsconfig.json",
      include: ["src/**/*.ts"],
    }),
    noNodeBuiltins(),
    cliShebang(),
  ],
  build: {
    outDir: "dist",
    // Use Rollup multi-entry to expose subpath modules
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        index: "src/index.ts",
        // Ports
        fetch: "src/ports/fetch/index.ts",
        // Expose individual fetch emulators as direct subpath entries
        "fetch/openai": "src/ports/fetch/openai.ts",
        "fetch/gemini": "src/ports/fetch/gemini.ts",
        "fetch/claude": "src/ports/fetch/claude.ts",
        // Adapters (major conversions)
        "adapters/openai-compatible": "src/adapters/openai-compatible/index.ts",
        "adapters/openai-to-claude": "src/adapters/openai-to-claude/index.ts",
        "adapters/openai-to-gemini-v1beta": "src/adapters/openai-to-gemini-v1beta/index.ts",
        "adapters/gemini-to-openai": "src/adapters/gemini-to-openai/index.ts",
        "adapters/claude-to-openai": "src/adapters/claude-to-openai/index.ts",
        // Providers
        "providers/openai": "src/providers/openai/index.ts",
        "providers/claude": "src/providers/claude/index.ts",
        "providers/gemini": "src/providers/gemini/index.ts",
        "bin/gateway-server": "src/gateway/cli/server.ts",
      },
      external: [/^node:.+/, /@anthropic-ai\//, /^openai(\/.*)?$/, "@hono/node-server"],
      output: [
        {
          dir: "dist",
          format: "es",
          preserveModules: true,
          preserveModulesRoot: "src",
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
        },
        {
          dir: "dist",
          format: "cjs",
          preserveModules: true,
          preserveModulesRoot: "src",
          entryFileNames: "[name].cjs",
          chunkFileNames: "chunks/[name]-[hash].cjs",
          exports: "named",
        },
      ],
    },
  },
});
