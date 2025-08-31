/**
 * @file Snapshot markdown sample parse events to JSONL.
 *
 * - Reads all `.md` files under `src/utils/markdown/__mocks__/markdown-samples`
 * - Streams each file through the streaming markdown parser
 * - Writes each emitted parse event as a JSONL line to this folder
 *
 * Usage (with a TS runner like tsx or ts-node, or Bun):
 *   bun run tsx src/utils/markdown/scripts/snapshot-samples-to-jsonl.ts
 */
import { readdirSync, readFileSync, rmSync, statSync, mkdirSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { createStreamingMarkdownParser } from "../streaming-parser";
import type { MarkdownParseEvent } from "../types";
import { createJsonlWriter } from "../../jsonl/writer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

async function main() {
  // Paths
  const scriptsDir = __dirname;
  const samplesDir = resolve(scriptsDir, "..", "__mocks__", "markdown-samples");
  // Ensure snapshot output directory exists
  const snapshotsDir = resolve(scriptsDir, "__snapshots__");
  mkdirSync(snapshotsDir, { recursive: true });

  // Collect markdown sample files
  const entries = readdirSync(samplesDir)
    .map((name) => ({ name, full: join(samplesDir, name) }))
    .filter(({ full }) => {
      const stats = statSync(full);
      if (!stats.isFile()) {
        return false;
      }
      const ext = extname(full).toLowerCase();
      return ext === ".md";
    });

  for (const { name, full } of entries) {
    const fileBase = basename(name);
    const stem = basename(name, extname(name));
    const outFile = resolve(snapshotsDir, `${stem}-stream.jsonl`);

    // Prepare output for this sample: remove existing snapshot to avoid appending duplicates
    try {
      rmSync(outFile, { force: true });
    } catch {
      // ignore
    }
    const writer = createJsonlWriter(outFile);
    const text = readFileSync(full, "utf8");
    // Deterministic parser configuration for stable snapshots
    const parser = createStreamingMarkdownParser({
      maxDeltaChunkSize: 12,
      tableOutputMode: "structured",
    });

    const events: MarkdownParseEvent[] = [];

    // Process whole file content in one pass for stable detection and output
    for await (const ev of parser.processChunk(text)) {
      events.push(ev);
    }

    // Flush/close any remaining open blocks
    for await (const ev of parser.complete()) {
      events.push(ev);
    }

    // Write events to JSONL
    for (const [idx, ev] of events.entries()) {
      await writer.write({ sample: fileBase, index: idx, event: ev });
    }

    // Progress log per sample
    console.log(`Snapshotted ${events.length} events from ${fileBase}`);

    await writer.close();
    console.log(`Wrote JSONL snapshot to: ${outFile}`);
  }
}

// Run if executed directly
main();
