/**
 * @file Codex CLI driver (non-interactive via `exec` subcommand)
 */
import { createWriteStream } from "node:fs";
import { promises as fsp } from "node:fs";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";
import { assertNoLoginPromptOrThrow } from "./login-detect";
import { assertNoCliErrorOutput } from "./error-detect";
import { readFileSafe } from "../../../utils/fs";
import { spawnStream } from "../../../utils/proc/spawn";

/**
 * Codex 非対話モード: `codex exec <PROMPT> -C <sessionDir> -s read-only -a never`
 * - 出力は markdown テキストを stdout に流す（ストリーム対応）
 */
export function createCodexDriver(binPath: string, args?: string[]): CodingAgentDriver {
  return {
    async start(prompt: string, session: AgentSessionPaths) {
      await fsp.writeFile(session.inputPath, prompt);
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
      const out = createWriteStream(session.outputPath, { encoding: "utf8" as BufferEncoding });
      await spawnStream({
        cmd: binPath,
        args: argv,
        cwd: session.rootDir,
        mode: "text",
        writable: out,
        onValidateClose: async (stderr: string) => {
          assertNoLoginPromptOrThrow("", stderr);
          const snapshot = await readFileSafe(session.outputPath);
          assertNoCliErrorOutput(snapshot, stderr);
        },
      });
      return {};
    },
    parseResult(stdoutOrFile: string) {
      return { text: stdoutOrFile };
    },
  };
}

// No local fs helpers; using shared utils
