/**
 * @file Debug logging utilities for test scenarios
 */
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Creates a timestamped log directory for organizing test outputs
 * @param sourceTarget - The source-target pair (e.g., "claude-openai", "openai-claude")
 * @returns The log directory path in format logs/[yyyy-MM-dd-hh-mm-ss]/[source-target]
 */
export function createLogDirectory(sourceTarget: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, 19); // yyyy-MM-dd-hh-mm-ss

  const logDir = `logs/${timestamp}/${sourceTarget}`;

  // Create directory structure
  mkdirSync(logDir, { recursive: true });
  writeFileSync(`${logDir}/.gitkeep`, "");

  return logDir;
}
