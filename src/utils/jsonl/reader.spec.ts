/**
 * @file Tests for JSONL reader utilities
 */
import { readJsonl, readJsonlFromStream, readJsonlToArray } from "./reader";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("JSONL Reader", () => {
  const testFile = join(tmpdir(), "test-jsonl-reader.jsonl");

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  describe("readJsonl", () => {
    it("should read simple JSONL file with single object", async () => {
      const data = '{"name": "Alice", "age": 30}\n';
      writeFileSync(testFile, data);

      const results = [];
      for await (const item of readJsonl(testFile)) {
        results.push(item);
      }

      expect(results).toEqual([{ name: "Alice", age: 30 }]);
    });

    it("should read JSONL file with multiple objects", async () => {
      const data = `{"name": "Alice", "age": 30}
{"name": "Bob", "age": 25}
{"name": "Charlie", "age": 35}`;
      writeFileSync(testFile, data);

      const results = [];
      for await (const item of readJsonl(testFile)) {
        results.push(item);
      }

      expect(results).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
        { name: "Charlie", age: 35 },
      ]);
    });

    it("should handle empty lines and whitespace", async () => {
      const data = `{"name": "Alice"}

  
{"name": "Bob"}
   
`;
      writeFileSync(testFile, data);

      const results = [];
      for await (const item of readJsonl(testFile)) {
        results.push(item);
      }

      expect(results).toEqual([{ name: "Alice" }, { name: "Bob" }]);
    });

    it("should handle Windows line endings (CRLF)", async () => {
      const data = '{"name": "Alice"}\r\n{"name": "Bob"}\r\n';
      writeFileSync(testFile, data);

      const results = [];
      for await (const item of readJsonl(testFile)) {
        results.push(item);
      }

      expect(results).toEqual([{ name: "Alice" }, { name: "Bob" }]);
    });

    it("should handle empty file", async () => {
      writeFileSync(testFile, "");

      const results = [];
      for await (const item of readJsonl(testFile)) {
        results.push(item);
      }

      expect(results).toEqual([]);
    });

    it("should throw error for invalid JSON", async () => {
      const data = '{"name": "Alice"}\n{invalid json}\n';
      writeFileSync(testFile, data);

      const results = [];
      // eslint-disable-next-line no-restricted-syntax -- needed for test error tracking
      let caughtError: Error | null = null;

      try {
        for await (const item of readJsonl(testFile)) {
          results.push(item);
        }
      } catch (error) {
        caughtError = error as Error;
      }

      expect(results).toEqual([{ name: "Alice" }]);
      expect(caughtError).toBeDefined();
      expect(caughtError?.message).toContain("Invalid JSON in JSONL file");
      expect(caughtError?.message).toContain("{invalid json}");
    });

    it("should handle complex nested objects", async () => {
      const complexObj = {
        user: { name: "Alice", details: { age: 30, hobbies: ["reading", "coding"] } },
        meta: { timestamp: "2023-01-01T00:00:00Z", version: 1 },
      };
      const data = JSON.stringify(complexObj) + "\n";
      writeFileSync(testFile, data);

      const results = [];
      for await (const item of readJsonl(testFile)) {
        results.push(item);
      }

      expect(results).toEqual([complexObj]);
    });
  });

  describe("readJsonlFromStream", () => {
    it("should read from stream with single object", async () => {
      const data = '{"name": "Alice", "age": 30}\n';
      const stream = Readable.from([data]);

      const results = [];
      for await (const item of readJsonlFromStream(stream)) {
        results.push(item);
      }

      expect(results).toEqual([{ name: "Alice", age: 30 }]);
    });

    it("should read from stream with multiple objects", async () => {
      const data = `{"name": "Alice"}
{"name": "Bob"}
{"name": "Charlie"}`;
      const stream = Readable.from([data]);

      const results = [];
      for await (const item of readJsonlFromStream(stream)) {
        results.push(item);
      }

      expect(results).toEqual([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }]);
    });

    it("should handle chunked stream data", async () => {
      const stream = new Readable({
        read() {
          // Simulate chunked data
          this.push('{"name": "A');
          this.push('lice"}\n{"name"');
          this.push(': "Bob"}\n');
          this.push(null); // End stream
        },
      });

      const results = [];
      for await (const item of readJsonlFromStream(stream)) {
        results.push(item);
      }

      expect(results).toEqual([{ name: "Alice" }, { name: "Bob" }]);
    });

    it("should throw error for invalid JSON in stream", async () => {
      const data = '{"name": "Alice"}\n{invalid}\n';
      const stream = Readable.from([data]);

      const results = [];
      // eslint-disable-next-line no-restricted-syntax -- needed for test error tracking
      let caughtError: Error | null = null;

      try {
        for await (const item of readJsonlFromStream(stream)) {
          results.push(item);
        }
      } catch (error) {
        caughtError = error as Error;
      }

      expect(results).toEqual([{ name: "Alice" }]);
      expect(caughtError).toBeDefined();
      expect(caughtError?.message).toContain("Invalid JSON in JSONL stream");
    });

    it("should handle empty stream", async () => {
      const stream = Readable.from([""]);

      const results = [];
      for await (const item of readJsonlFromStream(stream)) {
        results.push(item);
      }

      expect(results).toEqual([]);
    });
  });

  describe("readJsonlToArray", () => {
    it("should collect all items into array", async () => {
      const data = `{"id": 1, "name": "Alice"}
{"id": 2, "name": "Bob"}
{"id": 3, "name": "Charlie"}`;
      writeFileSync(testFile, data);

      const results = await readJsonlToArray(testFile);

      expect(results).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ]);
    });

    it("should return empty array for empty file", async () => {
      writeFileSync(testFile, "");

      const results = await readJsonlToArray(testFile);

      expect(results).toEqual([]);
    });

    it("should handle type parameter", async () => {
      type User = {
        id: number;
        name: string;
      };

      const data = `{"id": 1, "name": "Alice"}
{"id": 2, "name": "Bob"}`;
      writeFileSync(testFile, data);

      const results = await readJsonlToArray<User>(testFile);

      expect(results).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]);
      expect(results[0].id).toBe(1);
      expect(results[0].name).toBe("Alice");
    });
  });

  describe("error handling", () => {
    it("should preserve original error information", async () => {
      const data = '{"valid": true}\n{"invalid": }\n';
      writeFileSync(testFile, data);

      // eslint-disable-next-line no-restricted-syntax -- needed for test error tracking
      let thrownError: Error | null = null;

      try {
        for await (const _item of readJsonl(testFile)) {
          // Intentionally unused - just testing the iteration
          void _item;
        }
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain("Invalid JSON in JSONL file");
      expect(thrownError?.message).toContain('{"invalid": }');
    });
  });
});
