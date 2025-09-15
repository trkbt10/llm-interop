/**
 * @file Generic CLI driver implementation for coding-agent adapter
 */
import { createWriteStream } from "node:fs";
import { promises as fsp } from "node:fs";
import { execFileString } from "../../../utils/proc/exec";
import { spawnStream } from "../../../utils/proc/spawn";
import { assertNoLoginPromptOrThrow, extractErrorText } from "./login-detect";
import { assertNoCliErrorOutput } from "./error-detect";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";
import { readFileSafe } from "../../../utils/fs";
import { stripCodeFence } from "../core/text";

function parseJsonResult(stdout: string): { text: string } {
  try {
    const parsed = JSON.parse(stdout) as { result?: string };
    const raw = typeof parsed.result === "string" ? parsed.result : "";
    return { text: stripCodeFence(raw) };
  } catch {
    return { text: stdout };
  }
}

/**
 * Create a generic CLI driver that executes a binary with optional args, writes markdown text to output.log,
 * and when outputFormat=json, also writes raw JSON to result.json and writes parsed text to output.log.
 */
export function createGenericCLIDriver(
  binPath: string,
  args?: string[],
  produces?: "json" | "jsonl" | "text",
): CodingAgentDriver {
  return {
    async start(prompt: string, session: AgentSessionPaths) {
      await fsp.writeFile(session.inputPath, prompt);
      const argv = Array.isArray(args) ? [...args] : [];
      if (produces === "text" || produces === "jsonl") {
        const out = createWriteStream(session.outputPath, { encoding: "utf8" as BufferEncoding });
        await spawnStream({
          cmd: binPath,
          args: argv,
          cwd: session.rootDir,
          mode: produces === "jsonl" ? "jsonl" : "text",
          writable: out,
          onValidateClose: async (stderr: string) => {
            assertNoLoginPromptOrThrow("", stderr);
            const snapshot = await readFileSafe(session.outputPath);
            assertNoCliErrorOutput(snapshot, stderr);
          },
        });
      } else {
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
        assertNoCliErrorOutput(stdout);
        if (session.resultPath) {
          await fsp.writeFile(session.resultPath, stdout);
        }
        await fsp.writeFile(session.outputPath, parseJsonResult(stdout).text);
      }
      return {};
    },
    parseResult(stdoutOrFile: string) {
      if (produces === "json") {
        return parseJsonResult(stdoutOrFile);
      }
      return { text: stdoutOrFile };
    },
  };
}

// No local exec/fs helpers; using shared utils
