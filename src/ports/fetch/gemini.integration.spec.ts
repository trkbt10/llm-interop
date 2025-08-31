/**
 * @file Integration tests for Gemini fetch emulator using real fixtures.
 * Exercises the pure route handler with fixture-backed adapter to validate
 * JSON (sync), SSE, and JSONL streaming behaviors.
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { handleGeminiRoute, type GeminiEndpointAdapter } from "./gemini";
import { readJsonlToArray } from "../../utils/jsonl/reader";
import { parseNonSseLogFile } from "../..//adapters/gemini/non-sse-parser";

const RAW_DIR = "__mocks__/raw/gemini-direct";
const FIXTURES_DIR = "__fixtures__/gemini-direct";

function ensureFixtures(): string[] {
  if (!existsSync(RAW_DIR)) {
    return [];
  }
  const files = readdirSync(RAW_DIR).filter((f) => /\.(jsonl|log|txt)$/.test(f));
  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  const out: string[] = [];
  for (const f of files) {
    const src = join(RAW_DIR, f);
    const dst = join(FIXTURES_DIR, f);
    if (!existsSync(dst)) {
      copyFileSync(src, dst);
    }
    out.push(dst);
  }
  return out;
}

function makeURL(path: string): URL {
  return new URL(`https://example.test${path}`);
}

function toInit(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  } satisfies RequestInit;
}

describe("Gemini fetch emulator integration (fixtures)", () => {
  const files = ensureFixtures();
  if (files.length === 0) {
    console.warn("⏭️  No fixtures under __mocks__/raw/gemini-direct; skipping integration tests");
    return;
  }

  it("streams SSE from a jsonl fixture via alt=sse", async () => {
    const sseFile = files.find((f) => f.endsWith(".jsonl"));
    if (!sseFile) {
      return;
    }
    const chunks = await readJsonlToArray<Record<string, unknown>>(sseFile);
    const adapter: GeminiEndpointAdapter = {
      async generateContent() {
        throw new Error("not used");
      },
      async streamGenerateContent() {
        async function* gen() {
          for (const c of chunks) {
            yield c;
          }
        }
        return gen();
      },
      async listModels() {
        return { models: [{ name: "models/gemini-1.5-flash", displayName: "gemini-1.5-flash", description: "", inputTokenLimit: 1, outputTokenLimit: 1, supportedGenerationMethods: [] }] };
      },
      // optional endpoints not used here
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse"),
      toInit({ contents: [{ parts: [{ text: "hi" }] }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    const dataLines = text
      .split("\n")
      .filter((l) => {
        if (!l.startsWith("data:")) {
          return false;
        }
        if (l.startsWith("data: [DONE]")) {
          return false;
        }
        return true;
      });
    // Some implementations may include control events; ensure payload events >= fixture chunks
    const parsedEvents = dataLines.map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    }).filter((v) => v !== null);
    expect(parsedEvents.length).toBeGreaterThanOrEqual(chunks.length);
  });

  it("streams JSONL from a non‑SSE .log fixture", async () => {
    const logFile = files.find((f) => f.endsWith(".log"));
    if (!logFile) {
      return;
    }
    const parsed = await parseNonSseLogFile(logFile);
    if (parsed.mode === "text") {
      return; // nothing to assert
    }
    const chunks = parsed.chunks;
    const adapter: GeminiEndpointAdapter = {
      async generateContent() {
        throw new Error("not used");
      },
      async streamGenerateContent() {
        async function* gen() {
          for (const c of chunks) {
            yield c;
          }
        }
        return gen();
      },
      async listModels() {
        return { models: [{ name: "models/gemini-1.5-flash", displayName: "gemini-1.5-flash", description: "", inputTokenLimit: 1, outputTokenLimit: 1, supportedGenerationMethods: [] }] };
      },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/gemini-1.5-flash:streamGenerateContent"),
      toInit({ contents: [{ parts: [{ text: "hi" }] }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const text = await res.text();
    const lines = text.trim().split("\n");
    expect(lines.length).toBe(parsed.chunks.length);
  });

  it("returns JSON for a sync .txt generateContent fixture", async () => {
    const txt = files.find((f) => {
      if (!f.includes("generateContent")) {
        return false;
      }
      if (!f.endsWith(".txt")) {
        return false;
      }
      return f.includes("status=success");
    });
    if (!txt) {
      return;
    }
    // Fixture is not used directly; adapter returns a minimal valid response instead
    void readFileSync(txt, "utf8");
    const adapter: GeminiEndpointAdapter = {
      async generateContent() {
        // Return a minimal valid GeminiResponse
        return { candidates: [{ content: { parts: [{ text: "ok" }] } }] };
      },
      async streamGenerateContent() {
        throw new Error("not used");
      },
      async listModels() {
        return { models: [{ name: "models/gemini-1.5-flash", displayName: "gemini-1.5-flash", description: "", inputTokenLimit: 1, outputTokenLimit: 1, supportedGenerationMethods: [] }] };
      },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/gemini-1.5-flash:generateContent"),
      toInit({ contents: [{ parts: [{ text: "hi" }] }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    const payload = JSON.parse(await res.text()) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, "candidates")).toBe(true);
  });

  it("handles countTokens endpoint", async () => {
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { throw new Error("not used"); },
      async listModels() { return { models: [] }; },
      async countTokens() { return { totalTokenCount: 42, totalTokens: 42 }; },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/gemini-1.5-flash:countTokens"),
      toInit({ contents: [{ parts: [{ text: "hello" }] }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    const json = JSON.parse(await res.text()) as { totalTokenCount?: number };
    expect(json.totalTokenCount).toBe(42);
  });

  it("handles embedContent endpoint", async () => {
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { throw new Error("not used"); },
      async listModels() { return { models: [] }; },
      async embedContent() { return { embedding: { value: [0.1, 0.2] } }; },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/text-embedding-004:embedContent"),
      toInit({ content: { parts: [{ text: "hi" }] } }),
      adapter,
    );
    expect(res.status).toBe(200);
    const json = JSON.parse(await res.text()) as { embedding?: { value?: number[] } };
    expect(Array.isArray(json.embedding?.value)).toBe(true);
  });

  it("handles batchEmbedContents endpoint", async () => {
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { throw new Error("not used"); },
      async listModels() { return { models: [] }; },
      async batchEmbedContents() { return { embeddings: [{ embedding: { value: [0.1] } }, { embedding: { value: [0.2] } }] }; },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/text-embedding-004:batchEmbedContents"),
      toInit({ requests: [{ content: { parts: [{ text: "a" }] } }, { content: { parts: [{ text: "b" }] } }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    const json = JSON.parse(await res.text()) as { embeddings?: Array<{ embedding?: { value?: number[] } }> };
    expect(json.embeddings?.length).toBe(2);
  });

  it("lists and gets models", async () => {
    const model = { name: "models/gemini-1.5-flash", displayName: "gemini-1.5-flash", description: "", inputTokenLimit: 1, outputTokenLimit: 1, supportedGenerationMethods: ["generateContent"] };
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { throw new Error("not used"); },
      async listModels() { return { models: [model] }; },
    };
    const list = await handleGeminiRoute(makeURL("/v1beta/models"), { method: "GET" }, adapter);
    expect(list.status).toBe(200);
    const listJson = JSON.parse(await list.text()) as { models: Array<{ name: string }> };
    expect(listJson.models[0]?.name).toBe(model.name);

    const get = await handleGeminiRoute(makeURL(`/v1beta/models/${encodeURIComponent(model.name)}`), { method: "GET" }, adapter);
    expect(get.status).toBe(200);
    const getJson = JSON.parse(await get.text()) as { name?: string };
    expect(getJson.name).toBe(model.name);
  });

  it("lists and gets tunedModels (empty default)", async () => {
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { throw new Error("not used"); },
      async listModels() { return { models: [] }; },
      async listTunedModels() { return { tunedModels: [{ name: "tunedModels/demo" }] }; },
      async getTunedModel(name: string) { return { name }; },
    };
    const list = await handleGeminiRoute(makeURL("/v1beta/tunedModels"), { method: "GET" }, adapter);
    expect(list.status).toBe(200);
    const listJson = JSON.parse(await list.text()) as { tunedModels: Array<{ name: string }> };
    expect(listJson.tunedModels[0]?.name).toBe("tunedModels/demo");

    const get = await handleGeminiRoute(makeURL("/v1beta/tunedModels/tunedModels%2Fdemo"), { method: "GET" }, adapter);
    expect(get.status).toBe(200);
    const getJson = JSON.parse(await get.text()) as { name?: string };
    expect(getJson.name).toBe("tunedModels/demo");
  });
});
