/**
 * @file Promise-based execFile helpers with optional stdin and error augmentation
 */
import { execFile, type ExecFileOptions } from "node:child_process";

export type ExecStringOptions = Omit<ExecFileOptions, "encoding"> & { encoding?: BufferEncoding };

/**
 * Execute a file and return stdout as string. Attaches stdout/stderr to the thrown Error on failure.
 */
export function execFileString(
  file: string,
  args: string[] = [],
  opts: ExecStringOptions = {},
  input?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      {
        cwd: opts.cwd,
        timeout: opts.timeout,
        maxBuffer: opts.maxBuffer,
        env: opts.env,
        encoding: opts.encoding ?? ("utf8" as BufferEncoding),
      },
      (error, stdout, stderr) => {
        if (error) {
          const base = error instanceof Error ? error : new Error(String(error));
          if (typeof stdout !== "undefined") {
            Object.defineProperty(base, "stdout", { value: String(stdout), writable: true, configurable: true });
          }
          if (typeof stderr !== "undefined") {
            Object.defineProperty(base, "stderr", { value: String(stderr), writable: true, configurable: true });
          }
          reject(base);
          return;
        }
        resolve(stdout as string);
      },
    );
    if (input != null && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

