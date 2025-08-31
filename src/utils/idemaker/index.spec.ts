/**
 * @file Entry-level integration tests for idemaker.
 * Ensures `idFromText` matches the byte-path and modes align.
 */
import { idFromText, idFromBytes, textToBytes } from "./index.js";

describe("idemaker entry", () => {
  it("idFromText matches idFromBytes(textToBytes)", () => {
    const text = "hello";
    for (const mode of ["uuid4", "base64", "sha256"] as const) {
      const a = idFromText(text, mode);
      const b = idFromBytes(textToBytes(text), mode);
      expect(a).toBe(b);
    }
  });
});
