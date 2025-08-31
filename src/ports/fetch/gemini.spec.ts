/**
 * @file Unit tests for pure Gemini route handler
 */
import { handleGeminiRoute, type GeminiEndpointAdapter } from "./gemini";

function makeURL(path: string): URL {
  return new URL(`https://example.test${path}`);
}

function toInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  } satisfies RequestInit;
}

describe("Gemini route handler (pure)", () => {
  it("returns 404 for unknown paths", async () => {
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { throw new Error("not used"); },
      async listModels() { throw new Error("not used"); },
    };
    const res = await handleGeminiRoute(makeURL("/v1beta/unknown"), undefined, adapter);
    expect(res.status).toBe(404);
  });

  it("routes generateContent (sync) and returns JSON", async () => {
    const expected = { candidates: [{ content: { parts: [{ text: "ok" }], role: "model" } }] } as const;
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { return JSON.parse(JSON.stringify(expected)); },
      async streamGenerateContent() { throw new Error("not used"); },
      async listModels() { throw new Error("not used"); },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/gemini-1.5-flash:generateContent"),
      toInit("POST", { contents: [{ parts: [{ text: "hi" }] }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.text();
    expect(body).toContain("\"ok\"");
  });

  it("routes streamGenerateContent with alt=sse as SSE", async () => {
    async function* gen() { yield { a: 1 }; yield { b: 2 }; }
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { return gen(); },
      async listModels() { throw new Error("not used"); },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse"),
      toInit("POST", { contents: [{ parts: [{ text: "hi" }] }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("routes streamGenerateContent without alt as JSONL", async () => {
    async function* gen() { yield { a: 1 }; yield { b: 2 }; }
    const adapter: GeminiEndpointAdapter = {
      async generateContent() { throw new Error("not used"); },
      async streamGenerateContent() { return gen(); },
      async listModels() { throw new Error("not used"); },
    };
    const res = await handleGeminiRoute(
      makeURL("/v1beta/models/gemini-1.5-flash:streamGenerateContent"),
      toInit("POST", { contents: [{ parts: [{ text: "hi" }] }] }),
      adapter,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const text = await res.text();
    const lines = text.trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).a).toBe(1);
    expect(JSON.parse(lines[1]).b).toBe(2);
  });
});
