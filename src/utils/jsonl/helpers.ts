/**
 * @file Helpers for preparing JSONL output files in scripts.
 */
import { mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createJsonlWriter } from "./writer";

export type PreparedJsonl = {
  path: string;
  skipped: boolean;
  writer: ReturnType<typeof createJsonlWriter> | null;
};

/**
 * Ensures baseDir exists and returns a JSONL writer unless file already exists.
 * Logs a concise skip message when the target file is present.
 */
export async function prepareJsonlWriter(baseDir: string, filename: string): Promise<PreparedJsonl> {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }
  if (!filename) {
    throw new Error("filename is required");
  }

  await mkdir(baseDir, { recursive: true });
  const path = join(baseDir, filename);
  if (existsSync(path)) {
    try {
      const { size } = statSync(path);
      if (size > 0) {
        // Keep logs concise and consistent across scripts
        console.log(`⏭️  ${path} exists (size: ${size} bytes), skipping capture`);
        return { path, skipped: true, writer: null };
      }
      // File exists but empty → treat as not existing
      console.log(`↻ ${path} exists but is empty, will write`);
    } catch {
      // If stat fails for some reason, proceed to create writer
    }
  }
  return { path, skipped: false, writer: createJsonlWriter(path) };
}
