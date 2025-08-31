/** @file Unit tests for composed-attempts without using test framework imports or mocks */
import { runComposedAttempts, normalizeError } from "./composed-attempts";

describe("composed attempts utility", () => {
  it("returns first success when autoFallback=false and first succeeds", async () => {
    const calls = { a: 0, b: 0 };
    const a = async () => { calls.a += 1; return 1; };
    const b = async () => { calls.b += 1; return 2; };
    const result = await runComposedAttempts([a, b], { autoFallback: false });
    expect(result).toBe(1);
    expect(calls.a).toBe(1);
    expect(calls.b).toBe(0);
  });

  it("throws original error when autoFallback=false and first fails", async () => {
    const err = new Error("first failed");
    const calls = { a: 0, b: 0 };
    const a = async () => { calls.a += 1; throw err; };
    const b = async () => { calls.b += 1; return 2; };
    await expect(runComposedAttempts([a, b], { autoFallback: false })).rejects.toBe(err);
    expect(calls.a).toBe(1);
    expect(calls.b).toBe(0);
  });

  it("falls back to next attempt when autoFallback=true", async () => {
    const calls = { a: 0, b: 0 };
    const a = async () => { calls.a += 1; throw new Error("first failed"); };
    const b = async () => { calls.b += 1; return 42; };
    const result = await runComposedAttempts([a, b], { autoFallback: true });
    expect(result).toBe(42);
    expect(calls.a).toBe(1);
    expect(calls.b).toBe(1);
  });

  it("throws AggregateError when all attempts fail and autoFallback=true", async () => {
    const e1 = new Error("a");
    const e2 = new Error("b");
    const calls = { a: 0, b: 0 };
    const a = async () => { calls.a += 1; throw e1; };
    const b = async () => { calls.b += 1; throw e2; };
    await expect(runComposedAttempts([a, b], { autoFallback: true })).rejects.toMatchObject({
      name: "AggregateError",
      errors: expect.arrayContaining([e1, e2]),
    });
    expect(calls.a).toBe(1);
    expect(calls.b).toBe(1);
  });

  it("normalizeError wraps non-Error values", () => {
    const n1 = normalizeError("boom");
    expect(n1).toBeInstanceOf(Error);
    expect(n1.message).toContain("boom");
    const orig = new Error("x");
    const n2 = normalizeError(orig);
    expect(n2).toBe(orig);
  });
});
