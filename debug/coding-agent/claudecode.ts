/**
 * @file Demo runner for Claude Code driver
 * Usage:
 *   CODING_AGENT_KIND=claude-code CODING_AGENT_BIN=/path/to/claude CODING_AGENT_PRODUCES=json \
 *   bun run debug/coding-agent/claudecode.ts
 */
import { runCommonScenario } from "./common-scenario";
import type { Provider } from "../../src/config/types";


async function main(): Promise<void> {
  const provider: Provider = {
    type: "coding-agent",
    model: "claude-code",
    codingAgent: {
      kind: "claude-code",
      binPath: (() => {
        const v = process.env.CODING_AGENT_BIN;
        return typeof v === "string" && v.length > 0 ? v : "claude";
      })(),
      args: (() => {
        const v = process.env.CODING_AGENT_ARGS;
        if (!v) {
          return [];
        }
        return v.split(/\s+/).filter(Boolean);
      })(),
      produces: (() => {
        const v = process.env.CODING_AGENT_PRODUCES;
        return v === "json" || v === "text" ? (v as "json" | "text") : "json";
      })(),
    },
  };
  await runCommonScenario(provider, "claude-code");
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ? err.message : String(err));
  process.exit(1);
});
