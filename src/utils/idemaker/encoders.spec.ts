/**
 * @file Tests for byte-to-string encoders.
 * Ensures hex and Base64URL encoders produce stable, padding-free outputs.
 */
import { toBase64Url, toHex } from "./encoders.js";

describe("encoders", () => {
  it("toHex converts bytes to hex", () => {
    const b = new Uint8Array([0, 1, 255]);
    expect(toHex(b)).toBe("0001ff");
  });

  it("toBase64Url encodes without padding", () => {
    // "foo" => Zm9v
    const foo = new Uint8Array([102, 111, 111]);
    expect(toBase64Url(foo)).toBe("Zm9v");
    // 1 byte => 2 chars
    expect(toBase64Url(new Uint8Array([0xff]))).toHaveLength(2);
    // 2 bytes => 3 chars
    expect(toBase64Url(new Uint8Array([0xff, 0xee]))).toHaveLength(3);
  });
});
