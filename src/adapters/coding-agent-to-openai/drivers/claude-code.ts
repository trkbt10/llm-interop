/**
 * @file Claude Code driver implementation for coding-agent adapter
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";
import { assertNoLoginPromptOrThrow, extractErrorText } from "./login-detect";

function stripCodeFence(text: string): string {
  const fence = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)```\s*$/m;
  const trimmed = text.trim();
  const m = trimmed.match(fence);
  if (!m) {
    return text;
  }
  const inner0 = m[1];
  return inner0.endsWith("\n") ? inner0.slice(0, -1) : inner0;
}

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
      writeFileSync(session.inputPath, prompt);
      const argv = Array.isArray(args) ? [...args] : [];
      if (produces === "json" && !argv.includes("--output-format")) {
        argv.push("--output-format", "json");
      }
      let stdout = "";
      try {
        stdout = execFileSync(binPath, argv, {
          input: prompt,
          encoding: "utf8" as BufferEncoding,
          timeout: 5 * 60 * 1000,
          maxBuffer: 8 * 1024 * 1024,
          cwd: session.rootDir,
        });
      } catch (err) {
        const text = extractErrorText(err);
        assertNoLoginPromptOrThrow("", text);
        throw err;
      }
      assertNoLoginPromptOrThrow(stdout);
      if (produces === "json") {
        const parsed = parseResultJSON(stdout);
        writeFileSync(session.outputPath, parsed.text);
        if (session.resultPath) {
          writeFileSync(session.resultPath, stdout);
        }
      } else {
        writeFileSync(session.outputPath, stdout);
      }
      return {};
    },
    parseResult(stdoutOrFile: string) {
      return parseResultJSON(stdoutOrFile);
    },
  };
}
