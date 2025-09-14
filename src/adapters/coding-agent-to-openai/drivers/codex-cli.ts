/**
 * @file Codex CLI driver (non-interactive via `exec` subcommand)
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";
import { assertNoLoginPromptOrThrow } from "./login-detect";
import { assertNoCliErrorOutput } from "./error-detect";

/**
 * Codex 非対話モード: `codex exec <PROMPT> -C <sessionDir> -s read-only -a never`
 * - 出力は markdown テキストを stdout に流す（ストリーム対応）
 */
export function createCodexDriver(binPath: string, args?: string[]): CodingAgentDriver {
  return {
    async start(prompt: string, session: AgentSessionPaths) {
      writeFileSync(session.inputPath, prompt);
      const base = Array.isArray(args) ? [...args] : [];
      // Place root-level flags BEFORE the subcommand to satisfy Codex CLI parsing
      const argv = [
        ...base,
        "-C",
        session.rootDir,
        "-s",
        "read-only",
        "-a",
        "never",
        "exec",
        "--skip-git-repo-check",
        prompt,
      ];
      const child = spawn(binPath, argv, { cwd: session.rootDir });
      const errChunks: string[] = [];
      child.stdout.on("data", (buf: Buffer) => {
        const s = buf.toString("utf8");
        appendFileSync(session.outputPath, s);
      });
      child.stderr.on("data", (buf: Buffer) => errChunks.push(buf.toString("utf8")));
      await new Promise<void>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code: number) => {
          const stderr = errChunks.join("");
          try {
            assertNoLoginPromptOrThrow("", stderr);
            const outSnapshot = readOutput(session.outputPath);
            assertNoCliErrorOutput(outSnapshot, stderr);
          } catch (e) {
            reject(e);
            return;
          }
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Codex CLI exited with code ${code}: ${stderr.slice(0, 1000)}`));
          }
        });
      });
      return {};
    },
    parseResult(stdoutOrFile: string) {
      return { text: stdoutOrFile };
    },
  };
}

function readOutput(path: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    return fs.readFileSync(path, { encoding: "utf8" as BufferEncoding });
  } catch {
    return "";
  }
}
