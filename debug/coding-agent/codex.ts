/**
 * @file Demo runner for Codex CLI driver
 * Usage:
 *   CODING_AGENT_KIND=codex-cli CODING_AGENT_BIN=/path/to/codex CODING_AGENT_PRODUCES=text \
 *   bun run debug/coding-agent/codex.ts
 */
import { runCommonScenario } from "./common-scenario";
import type { Provider } from "../../src/config/types";


async function main(): Promise<void> {
  const provider: Provider = {
    type: "coding-agent",
    model: "codex-cli",
    codingAgent: {
      kind: "codex-cli",
      binPath: (() => {
        const v = process.env.CODING_AGENT_BIN;
        return typeof v === "string" && v.length > 0 ? v : "codex";
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
        return v === "json" || v === "text" ? (v as "json" | "text") : "text";
      })(),
    },
  };
  await runCommonScenario(provider, "codex-cli");
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ? err.message : String(err));
  process.exit(1);
});
