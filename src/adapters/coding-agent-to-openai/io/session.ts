/**
 * @file Session management utilities (tmp workspace per run)
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Session = {
  id: string;
  paths: {
    rootDir: string;
    inputPath: string;
    outputPath: string;
    resultPath: string;
  };
};

export function createSession(): Session {
  const rootDir = mkdtempSync(join(tmpdir(), "coding-agent-"));
  const inputPath = join(rootDir, "input.txt");
  const outputPath = join(rootDir, "output.log");
  const resultPath = join(rootDir, "result.json");
  writeFileSync(inputPath, "");
  writeFileSync(outputPath, "");
  return {
    id: rootDir.split("/").pop() ?? "session",
    paths: { rootDir, inputPath, outputPath, resultPath },
  };
}
