/**
 * @file Unit tests for coding-agent OpenAI-compatible adapter (uses vitest globals)
 */

import { buildOpenAICompatibleClientForCodingAgent } from "./openai-compatible";
import type { Provider } from "../../config/types";

function makeProvider(json = false): Provider {
  return {
    type: "coding-agent",
    model: "test-model",
    codingAgent: {
      binPath: "/bin/mock",
      ...(json ? { outputFormat: "json" as const } : {}),
    },
  };
}

describe("coding-agent openai-compatible", () => {
  it("chat.completions.create returns text completion for plain stdout", async () => {
    const provider = { ...makeProvider(false), codingAgent: { ...makeProvider(false).codingAgent, kind: "test-stub" } } as Provider;
    const client = buildOpenAICompatibleClientForCodingAgent(provider);
    const res = await client.chat.completions.create({
      model: "ignored",
      messages: [
        { role: "user", content: "hello" },
      ],
      stream: false,
    });
    expect(res.model).toBe("test-model");
    expect(res.choices[0]?.message?.role).toBe("assistant");
    expect(typeof res.choices[0]?.message?.content).toBe("string");
  });

  it("chat.completions.create parses JSON stdout when outputFormat=json", async () => {
    const provider = { ...makeProvider(true), codingAgent: { ...makeProvider(true).codingAgent, kind: "test-stub" } } as Provider;
    const client = buildOpenAICompatibleClientForCodingAgent(provider);
    const res = await client.chat.completions.create({ model: "x", messages: [{ role: "user", content: "hi" }], stream: false });
    expect(typeof res.choices[0]?.message?.content).toBe("string");
  });

  it("chat.completions.create returns markdown-delta chunks and stop when stream=true", async () => {
    const provider = { ...makeProvider(false), codingAgent: { ...makeProvider(false).codingAgent, kind: "test-stub" } } as Provider;
    const client = buildOpenAICompatibleClientForCodingAgent(provider);
    const stream = await client.chat.completions.create({ model: "x", messages: [{ role: "user", content: "abcd" }], stream: true });
    const out: { choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }> }[] = [];
    for await (const c of stream) {
      out.push(c);
    }
    const finish = out[out.length - 1]?.choices?.[0]?.finish_reason ?? null;
    expect(finish).toBe("stop");
    const text = out
      .map((c) => {
        const d = c.choices?.[0]?.delta;
        return typeof d?.content === "string" ? d.content : "";
      })
      .join("");
    expect(text).toContain("Echo:");
  });

  it("responses.create returns output_text for simple prompt", async () => {
    const provider = { ...makeProvider(false), codingAgent: { ...makeProvider(false).codingAgent, kind: "test-stub" } } as Provider;
    const client = buildOpenAICompatibleClientForCodingAgent(provider);
    const res = await client.responses.create({ model: "x", input: "hello" });
    expect(typeof res.output_text).toBe("string");
    expect(res.model).toBe("test-model");
  });

  it("throws if binPath is missing", async () => {
    const provider = { type: "coding-agent", model: "x", codingAgent: { binPath: "" } } as Provider;
    const client = buildOpenAICompatibleClientForCodingAgent(provider);
    await expect(
      client.chat.completions.create({ model: "m", messages: [{ role: "user", content: "hi" }], stream: false }),
    ).rejects.toThrow();
  });
});
