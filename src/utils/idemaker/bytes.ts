/**
 * @file Small byte helpers used across idemaker.
 * Favors explicit Uint8Array operations to remain platform-neutral and
 * predictable across runtimes.
 */

/**
 * Encode text as UTF-8 bytes.
 * Why: We operate on byte-level hashes; using TextEncoder avoids platform
 * differences and ensures consistent results for the same input text.
 */
export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Normalize an optional salt to bytes.
 * Why: The ID derivation prepends a salt to the keying material to create
 * deterministic but separated ID namespaces.
 */
export function normalizeSalt(s: string | Uint8Array): Uint8Array {
  return typeof s === "string" ? textToBytes(s) : s;
}

/**
 * Concatenate two byte arrays.
 * Why: Efficiently builds keying material (e.g., `salt || bytes`) without
 * allocating intermediate strings.
 */
export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
