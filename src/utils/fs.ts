/**
 * @file Small fs helpers
 */
import { promises as fsp } from "node:fs";

/**
 * Read a file as string asynchronously.
 * - Returns empty string ONLY when the file does not exist (ENOENT).
 * - For permission or other errors (e.g., EACCES, EPERM), rethrows to avoid hiding critical issues.
 */
export async function readFileSafe(path: string, encoding: BufferEncoding = "utf8"): Promise<string> {
  try {
    return await fsp.readFile(path, { encoding });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e && e.code === "ENOENT") {
      return "";
    }
    throw err;
  }
}
