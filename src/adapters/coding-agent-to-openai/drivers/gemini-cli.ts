/**
 * @file Gemini CLI driver (non-interactive via --prompt and optional --session-summary)
 */
import { promises as fsp } from "node:fs";
// child_process imported indirectly via shared exec helper
import { execFileString } from "../../../utils/proc/exec";
import { assertNoCliErrorOutput } from "./error-detect";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";
import { assertNoLoginPromptOrThrow, extractErrorText } from "./login-detect";

/**
 * Create a Gemini CLI driver that runs a one-shot prompt non-interactively.
 * - Sends the prompt via `--prompt` and writes stdout markdown to output.log.
 * - If a result path is provided, asks the CLI to emit a summary JSON via `--session-summary`.
 */
export function createGeminiCLIDriver(binPath: string, args?: string[]): CodingAgentDriver {
  return {
    async start(prompt: string, session: AgentSessionPaths) {
      await fsp.writeFile(session.inputPath, prompt);
      const argv = Array.isArray(args) ? [...args] : [];
      // Ensure non-interactive execution with a one-shot prompt
      argv.push("--prompt", prompt);
      // Ask CLI to write a session summary if available
      if (session.resultPath) {
        argv.push("--session-summary", session.resultPath);
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
      ).catch((err) => {
        const text = extractErrorText(err);
        assertNoLoginPromptOrThrow("", text);
        throw err;
      });
      assertNoLoginPromptOrThrow(stdout);
      assertNoCliErrorOutput(stdout);
      // Gemini CLI prints markdown to stdout; write to output.log
      await fsp.writeFile(session.outputPath, stdout);
      return {};
    },
    parseResult(stdoutOrFile: string) {
      // No special JSON format guaranteed; treat as plain text
      return { text: stdoutOrFile };
    },
  };
}

// No local exec helpers; use shared execFileString
