/**
 * @file Tests for JSONL writer utilities
 */
import { createJsonlWriter, writeJsonlFromArray, createJsonlStreamWriter } from "./writer";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { Writable } from "node:stream";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("JSONL Writer", () => {
  const testFile = join(tmpdir(), "test-jsonl-writer.jsonl");

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  describe("createJsonlWriter", () => {
    it("should write single object to file", async () => {
      const writer = createJsonlWriter(testFile);
      const testObj = { name: "Alice", age: 30 };

      await writer.write(testObj);
      await writer.close();

      const content = readFileSync(testFile, "utf8");
      expect(content).toBe('{"name":"Alice","age":30}\n');
    });

    it("should write multiple objects to file", async () => {
      const writer = createJsonlWriter(testFile);
      const objects = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];

      for (const obj of objects) {
        await writer.write(obj);
      }
      await writer.close();

      const content = readFileSync(testFile, "utf8");
      const expectedLines = ['{"id":1,"name":"Alice"}', '{"id":2,"name":"Bob"}', '{"id":3,"name":"Charlie"}', ""];
      expect(content).toBe(expectedLines.join("\n"));
    });

    it("should append to existing file", async () => {
      // Write initial content
      const writer1 = createJsonlWriter(testFile);
      await writer1.write({ name: "Alice" });
      await writer1.close();

      // Append more content
      const writer2 = createJsonlWriter(testFile);
      await writer2.write({ name: "Bob" });
      await writer2.close();

      const content = readFileSync(testFile, "utf8");
      expect(content).toBe('{"name":"Alice"}\n{"name":"Bob"}\n');
    });

    it("should handle complex nested objects", async () => {
      const writer = createJsonlWriter(testFile);
      const complexObj = {
        user: { name: "Alice", details: { age: 30, hobbies: ["reading", "coding"] } },
        meta: { timestamp: "2023-01-01T00:00:00Z", version: 1 },
      };

      await writer.write(complexObj);
      await writer.close();

      const content = readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());
      expect(parsed).toEqual(complexObj);
    });

    it("should handle null and undefined values", async () => {
      const writer = createJsonlWriter(testFile);

      await writer.write(null);
      await writer.write({ value: undefined, other: null });
      await writer.close();

      const content = readFileSync(testFile, "utf8");
      const lines = content.trim().split("\n");
      expect(lines[0]).toBe("null");
      expect(lines[1]).toBe('{"other":null}');
    });

    it("should handle primitive values", async () => {
      const writer = createJsonlWriter(testFile);

      await writer.write("string value");
      await writer.write(42);
      await writer.write(true);
      await writer.write(false);
      await writer.close();

      const content = readFileSync(testFile, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toEqual(['"string value"', "42", "true", "false"]);
    });

    it("should handle arrays", async () => {
      const writer = createJsonlWriter(testFile);
      const arrayData = [1, 2, { name: "test" }, "string"];

      await writer.write(arrayData);
      await writer.close();

      const content = readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());
      expect(parsed).toEqual(arrayData);
    });

    it("should use toJSON when available (SDK-like objects)", async () => {
      const writer = createJsonlWriter(testFile);
      const sdkLike: { toJSON: () => unknown; [k: string]: unknown } = {
        // Non-enumerable internal fields shouldn't show up
        get internal() {
          return { secret: true };
        },
        // The SDK objects often provide a toJSON that returns a plain object
        toJSON() {
          return { type: "chunk", choices: [{ delta: { content: "Hi" } }] };
        },
      };

      await writer.write(sdkLike);
      await writer.close();

      const content = readFileSync(testFile, "utf8").trim();
      expect(content).toBe('{"type":"chunk","choices":[{"delta":{"content":"Hi"}}]}');
    });
  });

  describe("writeJsonlFromArray", () => {
    it("should write array of objects to file", async () => {
      const objects = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];

      await writeJsonlFromArray(testFile, objects);

      const content = readFileSync(testFile, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(3);
      expect(JSON.parse(lines[0])).toEqual({ id: 1, name: "Alice" });
      expect(JSON.parse(lines[1])).toEqual({ id: 2, name: "Bob" });
      expect(JSON.parse(lines[2])).toEqual({ id: 3, name: "Charlie" });
    });

    it("should handle empty array", async () => {
      await writeJsonlFromArray(testFile, []);

      const content = readFileSync(testFile, "utf8");
      expect(content).toBe("");
    });

    it("should handle mixed data types in array", async () => {
      const mixed = [{ type: "object", value: { name: "test" } }, "string", 42, true, null, [1, 2, 3]];

      await writeJsonlFromArray(testFile, mixed);

      const content = readFileSync(testFile, "utf8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(6);
      expect(JSON.parse(lines[0])).toEqual({ type: "object", value: { name: "test" } });
      expect(JSON.parse(lines[1])).toBe("string");
      expect(JSON.parse(lines[2])).toBe(42);
      expect(JSON.parse(lines[3])).toBe(true);
      expect(JSON.parse(lines[4])).toBeNull();
      expect(JSON.parse(lines[5])).toEqual([1, 2, 3]);
    });
  });

  describe("createJsonlStreamWriter", () => {
    it("should write to stream", async () => {
      // eslint-disable-next-line no-restricted-syntax -- needed for test stream output accumulation
      let streamOutput = "";
      const mockStream = new Writable({
        write(chunk: Buffer | string, encoding: BufferEncoding | undefined, callback: (error?: Error | null) => void) {
          streamOutput += chunk.toString();
          callback();
          return true;
        },
      });

      const writer = createJsonlStreamWriter(mockStream);
      const testObj = { name: "Alice", age: 30 };

      await writer.write(testObj);

      expect(streamOutput).toBe('{"name":"Alice","age":30}\n');
    });

    it("should write multiple objects to stream", async () => {
      // eslint-disable-next-line no-restricted-syntax -- needed for test stream output accumulation
      let streamOutput = "";
      const mockStream = new Writable({
        write(chunk: Buffer | string, encoding: BufferEncoding | undefined, callback: (error?: Error | null) => void) {
          streamOutput += chunk.toString();
          callback();
          return true;
        },
      });

      const writer = createJsonlStreamWriter(mockStream);
      const objects = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];

      for (const obj of objects) {
        await writer.write(obj);
      }

      const expectedOutput = '{"id":1,"name":"Alice"}\n{"id":2,"name":"Bob"}\n';
      expect(streamOutput).toBe(expectedOutput);
    });

    it("should handle stream write errors", async () => {
      const errorMessage = "Stream write error";
      const mockStream = new Writable({
        write(chunk: Buffer | string, encoding: BufferEncoding | undefined, callback: (error?: Error | null) => void) {
          // Return false to indicate error, callback should be called asynchronously
          process.nextTick(() => {
            callback(new Error(errorMessage));
          });
          return false;
        },
      });

      // Prevent unhandled error events
      mockStream.on("error", () => {
        // Expected error, do nothing
      });

      const writer = createJsonlStreamWriter(mockStream);

      await expect(writer.write({ test: "data" })).rejects.toThrow(errorMessage);
    });

    it("should handle special characters and unicode", async () => {
      // eslint-disable-next-line no-restricted-syntax -- needed for test stream output accumulation
      let streamOutput = "";
      const mockStream = new Writable({
        write(chunk: Buffer | string, encoding: BufferEncoding | undefined, callback: (error?: Error | null) => void) {
          streamOutput += chunk.toString();
          callback();
          return true;
        },
      });

      const writer = createJsonlStreamWriter(mockStream);
      const testObj = {
        emoji: "😀🎉",
        special: "line\nbreak\ttab\"quote'apostrophe",
        unicode: "こんにちは",
      };

      await writer.write(testObj);

      // Verify the output contains properly escaped JSON
      expect(streamOutput).toContain('{"emoji":"😀🎉"');
      expect(streamOutput).toContain('"special":"line\\nbreak\\ttab\\"quote\'apostrophe"');
      expect(streamOutput).toContain('"unicode":"こんにちは"');
      expect(streamOutput.endsWith("\n")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle write errors gracefully", async () => {
      // Use a mock approach instead of real filesystem errors
      const mockStream = new Writable({
        write(chunk: Buffer | string, encoding: BufferEncoding | undefined, callback: (error?: Error | null) => void) {
          // Simulate file system error
          process.nextTick(() => {
            callback(new Error("ENOENT: no such file or directory"));
          });
          return false;
        },
      });

      // Prevent unhandled error events
      mockStream.on("error", () => {
        // Expected error, do nothing
      });

      const writer = createJsonlStreamWriter(mockStream);

      await expect(writer.write({ test: "data" })).rejects.toThrow(/ENOENT|no such file or directory/);
    });

    it("should handle close errors gracefully", async () => {
      const writer = createJsonlWriter(testFile);
      await writer.write({ test: "data" });

      // Close should not throw under normal circumstances
      await expect(writer.close()).resolves.not.toThrow();
    });
  });
});
