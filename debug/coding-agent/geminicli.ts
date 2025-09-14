/**
 * @file Demo runner for Gemini CLI driver
 * Usage:
 *   bun run debug/coding-agent/geminicli.ts
 */
import { runCommonScenario } from "./common-scenario";
import type { Provider } from "../../src/config/types";


async function main(): Promise<void> {
  const provider: Provider = {
    type: "coding-agent",
    model: "gemini-2.0-flash",
    codingAgent: {
      kind: "gemini-cli",
      binPath: (() => {
        const v = process.env.CODING_AGENT_BIN;
        return typeof v === "string" && v.length > 0 ? v : "gemini";
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
  await runCommonScenario(provider, "gemini-cli");
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ? err.message : String(err));
  process.exit(1);
});
