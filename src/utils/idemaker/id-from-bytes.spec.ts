/**
 * @file Tests for core ID generation from bytes.
 * Confirms formatting per mode and sensitivity to salt changes.
 */
import { idFromBytes } from "./id-from-bytes.js";
import type { IdOptions } from "./types.js";

describe("idFromBytes", () => {
  const sample = new TextEncoder().encode("sample");
  const opts: IdOptions = { salt: "ns", seed: 0x97c29b3d };

  it("uuid4 format with proper version/variant", () => {
    const id = idFromBytes(sample, "uuid4", opts);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("base64 url-safe 22 chars for 16 bytes", () => {
    const id = idFromBytes(sample, "base64", opts);
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("sha256-like hex is 64 chars", () => {
    const id = idFromBytes(sample, "sha256", opts);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("salt changes output", () => {
    const a = idFromBytes(sample, "base64", { salt: "a" });
    const b = idFromBytes(sample, "base64", { salt: "b" });
    expect(a).not.toBe(b);
  });
});
