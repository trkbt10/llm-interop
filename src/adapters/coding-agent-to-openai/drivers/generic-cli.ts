/**
 * @file Generic CLI driver implementation for coding-agent adapter
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { assertNoLoginPromptOrThrow, extractErrorText } from "./login-detect";
import { assertNoCliErrorOutput } from "./error-detect";
import type { AgentSessionPaths, CodingAgentDriver } from "./types";

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
      writeFileSync(session.inputPath, prompt);
      const argv = Array.isArray(args) ? [...args] : [];
      if (produces === "text" || produces === "jsonl") {
        const child = spawn(binPath, argv, { cwd: session.rootDir });
        let partial = "";
        child.stdout.on("data", (buf: Buffer) => {
          const s = buf.toString("utf8");
          if (produces === "text") {
            appendFileSync(session.outputPath, s);
            return;
          }
          // jsonl: parse per complete line
          partial += s;
          const lines = partial.split(/\r?\n/);
          partial = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const obj = JSON.parse(trimmed) as { result?: string };
              const out = typeof obj.result === "string" ? obj.result : "";
              if (out) appendFileSync(session.outputPath, out);
            } catch {
              // ignore bad line
            }
          }
        });
        const errChunks: string[] = [];
        child.stderr.on("data", (buf: Buffer) => errChunks.push(buf.toString("utf8")));
        await new Promise<void>((resolve, reject) => {
          child.on("error", reject);
          child.on("close", (code: number) => {
            const stderr = errChunks.join("");
            try {
              assertNoLoginPromptOrThrow("", stderr);
              // Additionally check for structured errors in stderr or the output snapshot
              const snapshot = readOutput(session.outputPath);
              assertNoCliErrorOutput(snapshot, stderr);
            } catch (e) {
              reject(e);
              return;
            }
            // flush trailing partial for jsonl (best-effort)
            if (produces === "jsonl" && partial.trim()) {
              try {
                const obj = JSON.parse(partial.trim()) as { result?: string };
                const out = typeof obj.result === "string" ? obj.result : "";
                if (out) appendFileSync(session.outputPath, out);
              } catch {
                // ignore
              }
            }
            if (code === 0) resolve();
            else reject(new Error(`CLI exited with code ${code}`));
          });
        });
      } else {
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
        assertNoCliErrorOutput(stdout);
        if (session.resultPath) {
          writeFileSync(session.resultPath, stdout);
        }
        writeFileSync(session.outputPath, parseJsonResult(stdout).text);
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

function readOutput(path: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    return fs.readFileSync(path, { encoding: "utf8" as BufferEncoding });
  } catch {
    return "";
  }
}
