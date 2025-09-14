/**
 * @file Equivalence checks for chat-guards refactors
 * Ensures guard logic remains behaviorally equivalent after lint-driven refactors.
 */

import { isChatCompletionContentPart, isContentPartArray } from "./content";
import { isChatCompletionMessage } from "./message";
import { isChatCompletionCreateParams, isChatCompletionUpdateParams, isChatCompletionStreamOptions } from "./params";
import { isChatCompletionChunk } from "./stream";
import { isObject } from "../../../utils/type-guards";

describe("chat-guards equivalence", () => {
  it("isContentPartArray matches baseline", () => {
    const cases: unknown[] = [
      null,
      undefined,
      123,
      "str",
      {},
      [],
      [{ type: "text", text: "hi" }],
      [{ type: "image_url", image_url: { url: "u" } }],
      [{}, { type: "text", text: "x" }],
    ];
    function baseline(v: unknown): boolean {
      if (!Array.isArray(v)) {
        return false;
      }
      for (const item of v) {
        if (!isChatCompletionContentPart(item)) {
          return false;
        }
      }
      return true;
    }
    for (const v of cases) {
      expect(isContentPartArray(v)).toBe(baseline(v));
    }
  });

  it("isChatCompletionMessage matches baseline", () => {
    const cases: unknown[] = [null, undefined, 0, {}, { role: 1 }, { role: "user" }, { role: "assistant" }, { role: "developer" }, { role: "tool" }, { role: "function" }, { role: "system" }];
    const allowed = new Set(["developer", "system", "user", "assistant", "tool", "function"]);
    function baseline(v: unknown): boolean {
      if (typeof v !== "object" || v === null) {
        return false;
      }
      const obj = v as Record<string, unknown>;
      const role = obj.role;
      if (typeof role !== "string") {
        return false;
      }
      return allowed.has(role);
    }
    for (const v of cases) {
      expect(isChatCompletionMessage(v)).toBe(baseline(v));
    }
  });

  it("params guards match baseline", () => {
    const a: unknown = { messages: [], model: "m" };
    const b: unknown = { messages: [{}], model: 1 };
    const c: unknown = {};

    function baselineCreateParams(v: unknown): boolean {
      if (!isObject(v)) {
        return false;
      }
      const obj = v as Record<string, unknown>;
      if (!Array.isArray(obj.messages)) {
        return false;
      }
      return typeof obj.model === "string";
    }

    expect(isChatCompletionCreateParams(a)).toBe(baselineCreateParams(a));
    expect(isChatCompletionCreateParams(b)).toBe(baselineCreateParams(b));
    expect(isChatCompletionCreateParams(c)).toBe(baselineCreateParams(c));

    const u1: unknown = { metadata: {} };
    const u2: unknown = { metadata: 1 };
    function baselineUpdateParams(v: unknown): boolean {
      if (!isObject(v)) {
        return false;
      }
      const obj = v as Record<string, unknown>;
      if (obj.metadata === undefined) {
        return false;
      }
      return isObject(obj.metadata);
    }
    expect(isChatCompletionUpdateParams(u1)).toBe(baselineUpdateParams(u1));
    expect(isChatCompletionUpdateParams(u2)).toBe(baselineUpdateParams(u2));

    const s1: unknown = { include_usage: true };
    const s2: unknown = { include_usage: "x" };
    function baselineStreamOptions(v: unknown): boolean {
      if (!isObject(v)) {
        return false;
      }
      const obj = v as Record<string, unknown>;
      if (obj.include_usage !== undefined && typeof obj.include_usage !== "boolean") {
        return false;
      }
      return true;
    }
    expect(isChatCompletionStreamOptions(s1)).toBe(baselineStreamOptions(s1));
    expect(isChatCompletionStreamOptions(s2)).toBe(baselineStreamOptions(s2));
  });

  it("isChatCompletionChunk matches baseline shape", () => {
    const base: unknown = {
      id: "id",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "m",
      choices: [],
    };
    function baselineChunk(v: unknown): boolean {
      if (!isObject(v)) {
        return false;
      }
      const obj = v as Record<string, unknown>;
      if (typeof obj.id !== "string") {
        return false;
      }
      if (obj.object !== "chat.completion.chunk") {
        return false;
      }
      if (typeof obj.created !== "number") {
        return false;
      }
      if (typeof obj.model !== "string") {
        return false;
      }
      if (!Array.isArray(obj.choices)) {
        return false;
      }
      return true;
    }
    expect(isChatCompletionChunk(base)).toBe(baselineChunk(base));
  });
});
