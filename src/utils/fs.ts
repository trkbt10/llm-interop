/**
 * @file Small fs helpers
 */
import { promises as fsp } from "node:fs";

/**
 * Read a file as string asynchronously. Returns empty string if the file does not exist or reading fails.
 */
export async function readFileSafe(path: string, encoding: BufferEncoding = "utf8"): Promise<string> {
  try {
    return await fsp.readFile(path, { encoding });
  } catch {
    return "";
  }
}
