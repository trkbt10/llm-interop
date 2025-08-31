/**
 * @file JSONL (JSON Lines) writer utilities for streaming output
 */
import { createWriteStream } from "node:fs";
import type { Writable } from "node:stream";

/**
 * Creates a JSONL writer that appends JSON objects as lines to a file
 * @param filePath Path to the output JSONL file
 * @returns Object with write and close methods
 */
export function createJsonlWriter(filePath: string) {
  const stream = createWriteStream(filePath, { flags: "a" }); // Append mode

  type JsonLike = { toJSON: () => unknown };
  const hasToJSON = (v: unknown): v is JsonLike => {
    if (typeof v !== "object" || v === null) {
      return false;
    }
    const candidate = v as { toJSON?: unknown };
    if (!("toJSON" in candidate)) {
      return false;
    }
    return typeof candidate.toJSON === "function";
  };

  return {
    /**
     * Writes a single object as a JSON line
     * @param obj Object to write
     */
    async write(obj: unknown): Promise<void> {
      return new Promise((resolve, reject) => {
        // Prefer object's custom JSON representation when available (e.g., SDK stream chunks)
        const serializable = hasToJSON(obj) ? obj.toJSON() : obj;
        const line = JSON.stringify(serializable) + "\n";
        stream.write(line, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },

    /**
     * Closes the write stream
     */
    async close(): Promise<void> {
      return new Promise((resolve, reject) => {
        stream.end((error: Error | null | undefined) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

/**
 * Writes an array of objects to a JSONL file
 * @param filePath Path to the output JSONL file
 * @param items Array of objects to write
 */
export async function writeJsonlFromArray(filePath: string, items: unknown[]): Promise<void> {
  const writer = createJsonlWriter(filePath);

  try {
    for (const item of items) {
      await writer.write(item);
    }
  } finally {
    await writer.close();
  }
}

/**
 * Creates a JSONL writer for a writable stream
 * @param stream Writable stream
 * @returns Object with write method
 */
export function createJsonlStreamWriter(stream: Writable) {
  type JsonLike = { toJSON: () => unknown };
  const hasToJSON = (v: unknown): v is JsonLike => {
    if (typeof v !== "object" || v === null) {
      return false;
    }
    const candidate = v as { toJSON?: unknown };
    if (!("toJSON" in candidate)) {
      return false;
    }
    return typeof candidate.toJSON === "function";
  };
  return {
    /**
     * Writes a single object as a JSON line
     * @param obj Object to write
     */
    async write(obj: unknown): Promise<void> {
      return new Promise((resolve, reject) => {
        // Prefer object's custom JSON representation when available (e.g., SDK stream chunks)
        const serializable = hasToJSON(obj) ? obj.toJSON() : obj;
        const line = JSON.stringify(serializable) + "\n";
        stream.write(line, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
