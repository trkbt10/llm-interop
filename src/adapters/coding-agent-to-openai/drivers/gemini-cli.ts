/**
 * @file Gemini CLI driver (non-interactive via --prompt and optional --session-summary)
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { assertNoCliErrorOutput } from "./error-detect";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";
import { assertNoLoginPromptOrThrow, extractErrorText } from "./login-detect";

export function createGeminiCLIDriver(binPath: string, args?: string[]): CodingAgentDriver {
  return {
    async start(prompt: string, session: AgentSessionPaths) {
      writeFileSync(session.inputPath, prompt);
      const argv = Array.isArray(args) ? [...args] : [];
      // Ensure non-interactive execution with a one-shot prompt
      argv.push("--prompt", prompt);
      // Ask CLI to write a session summary if available
      if (session.resultPath) {
        argv.push("--session-summary", session.resultPath);
      }

      let stdout = "";
      try {
        stdout = execFileSync(binPath, argv, {
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
      assertNoCliErrorOutput(stdout);
      // Gemini CLI prints markdown to stdout; write to output.log
      writeFileSync(session.outputPath, stdout);
      return {};
    },
    parseResult(stdoutOrFile: string) {
      // No special JSON format guaranteed; treat as plain text
      return { text: stdoutOrFile };
    },
  };
}
