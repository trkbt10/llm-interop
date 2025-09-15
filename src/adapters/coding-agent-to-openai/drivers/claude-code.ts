/**
 * @file Claude Code driver implementation for coding-agent adapter
 */
import { promises as fsp } from "node:fs";
// child_process imported indirectly via shared exec helper
import { execFileString } from "../../../utils/proc/exec";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";
import { assertNoLoginPromptOrThrow, extractErrorText } from "./login-detect";
import { stripCodeFence } from "../core/text";

/**
 * Parse Claude Code JSON stdout and extract markdown text + usage.
 */
function parseResultJSON(stdout: string): { text: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } } {
  const parsed = JSON.parse(stdout) as { result?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  const raw = typeof parsed.result === "string" ? parsed.result : "";
  const text = stripCodeFence(raw);
  const prompt_tokens = typeof parsed.usage?.input_tokens === "number" ? parsed.usage.input_tokens : 0;
  const completion_tokens = typeof parsed.usage?.output_tokens === "number" ? parsed.usage.output_tokens : 0;
  const total_tokens = prompt_tokens + completion_tokens;
  const usage = prompt_tokens || completion_tokens ? { prompt_tokens, completion_tokens, total_tokens } : undefined;
  return { text, usage };
}

/**
 * Create a Claude Code driver. When outputFormat=json, writes parsed text (markdown) to outputPath
 * and original JSON to resultPath.
 */
export function createClaudeCodeDriver(binPath: string, args?: string[], produces?: "json" | "text"): CodingAgentDriver {
  return {
    async start(prompt: string, session: AgentSessionPaths) {
      await fsp.writeFile(session.inputPath, prompt);
      const argv = Array.isArray(args) ? [...args] : [];
      if (produces === "json" && !argv.includes("--output-format")) {
        argv.push("--output-format", "json");
      }
      const stdout = await execFileString(
        binPath,
        argv,
        {
          encoding: "utf8" as BufferEncoding,
          timeout: 5 * 60 * 1000,
          maxBuffer: 8 * 1024 * 1024,
          cwd: session.rootDir,
        },
        prompt,
      ).catch((err) => {
        const text = extractErrorText(err);
        assertNoLoginPromptOrThrow("", text);
        throw err;
      });
      assertNoLoginPromptOrThrow(stdout);
      if (produces === "json") {
        const parsed = parseResultJSON(stdout);
        await fsp.writeFile(session.outputPath, parsed.text);
        if (session.resultPath) {
          await fsp.writeFile(session.resultPath, stdout);
        }
      } else {
        await fsp.writeFile(session.outputPath, stdout);
      }
      return {};
    },
    parseResult(stdoutOrFile: string) {
      return parseResultJSON(stdoutOrFile);
    },
  };
}

// No local exec helpers; use shared execFileString
