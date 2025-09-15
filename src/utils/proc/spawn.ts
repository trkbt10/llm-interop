/**
 * @file Child process spawn helpers for streaming stdout with cleanup
 */
import { spawn } from "node:child_process";
import type { Writable } from "node:stream";
import { readJsonlFromStream } from "../jsonl/reader";

export type SpawnStreamMode = "text" | "jsonl";

export type SpawnStreamOptions = {
  cmd: string;
  args?: string[];
  cwd?: string;
  mode: SpawnStreamMode;
  writable: Writable;
  // Called after process close, before resolution/rejection. Throw to reject.
  onValidateClose?: (stderrText: string) => void | Promise<void>;
};

/**
 * Spawn a child process and stream stdout to the provided writable.
 * - mode=text: pipes raw stdout
 * - mode=jsonl: parses JSON Lines and writes only the `result` string field of each object
 * Ensures writable is closed and child is terminated on error conditions.
 */
export function spawnStream(opts: SpawnStreamOptions): Promise<void> {
  const { cmd, args = [], cwd, mode, writable, onValidateClose } = opts;

  const killIfAlive = (child: ReturnType<typeof spawn>, signal: NodeJS.Signals) => {
    try {
      if (child.exitCode == null) {
        child.kill(signal);
      }
    } catch {
      // ignore kill errors
    }
  };

  const safeKill = (child: ReturnType<typeof spawn>) => {
    if (child.exitCode == null) {
      killIfAlive(child, "SIGTERM");
      const timer = setTimeout(() => {
        if (child.exitCode == null) {
          killIfAlive(child, "SIGKILL");
        }
      }, 1000);
      timer.unref?.();
    }
  };

  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd });
    const errChunks: string[] = [];

    child.stderr.on("data", (buf: Buffer) => {
      errChunks.push(buf.toString("utf8"));
    });

    const handleError = (err: unknown) => {
      try {
        writable.end();
      } catch {
        // ignore
      }
      safeKill(child);
      reject(err);
    };

    const readingPromise: Promise<void> | undefined = (() => {
      if (mode === "text") {
        child.stdout.pipe(writable);
        return undefined;
      }
      return (async () => {
        try {
          for await (const obj of readJsonlFromStream<{ result?: string }>(child.stdout)) {
            const piece = typeof obj?.result === "string" ? obj.result : "";
            if (piece) {
              writable.write(piece);
            }
          }
        } catch (e) {
          if (e instanceof Error && (e.name === "AbortError" || e.name === "PrematureCloseError")) {
            return;
          }
          throw e;
        }
      })();
    })();

    child.on("error", (err) => handleError(err));
    child.on("close", (code: number) => {
      const finalize = async () => {
        const stderrText = errChunks.join("");
        if (onValidateClose) {
          await onValidateClose(stderrText);
        }
        try {
          writable.end();
        } catch {
          // ignore
        }
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderrText.slice(0, 1000)}`));
        }
      };

      if (readingPromise) {
        readingPromise.then(() => finalize(), (err) => handleError(err));
        return;
      }
      void finalize();
    });
  });
}
