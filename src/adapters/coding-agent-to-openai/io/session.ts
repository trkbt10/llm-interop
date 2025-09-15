/**
 * @file Session management utilities (tmp workspace per run)
 */
import { promises as fsp } from "node:fs";
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

/**
 * Create a temporary session directory and seed input/output files.
 * Returns stable paths used by drivers to communicate with external CLIs.
 */
export async function createSession(): Promise<Session> {
  const rootDir = await fsp.mkdtemp(join(tmpdir(), "coding-agent-"));
  const inputPath = join(rootDir, "input.txt");
  const outputPath = join(rootDir, "output.log");
  const resultPath = join(rootDir, "result.json");
  await fsp.writeFile(inputPath, "");
  await fsp.writeFile(outputPath, "");
  return {
    id: rootDir.split("/").pop() ?? "session",
    paths: { rootDir, inputPath, outputPath, resultPath },
  };
}
