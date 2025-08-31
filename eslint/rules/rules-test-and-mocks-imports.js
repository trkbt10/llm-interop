// Base restrictions
export default {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "bun:test",
          message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
        },
        {
          name: "vitest",
          message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
        },
        {
          name: "@jest/globals",
          message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
        },
        {
          name: "jest",
          message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
        },
        {
          name: "mocha",
          message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
        },
      ],
      patterns: [
        {
          group: ["vitest/*", "jest/*", "mocha/*"],
          message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
        },
        {
          group: ["**/__mocks__/**"],
          message:
            "Importing from __mocks__ is restricted to spec files (*.spec.ts[x]) and files inside __mocks__ only.",
        },
      ],
    },
  ],
  "no-restricted-modules": [
    "error",
    {
      paths: ["bun:test", "vitest", "@jest/globals", "jest", "mocha"],
      patterns: ["vitest/*", "jest/*", "mocha/*", "**/__mocks__/**"],
    },
  ],
};
// Allow __mocks__ imports (still forbid test libs)
export const allowMocksRuleSet = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "bun:test", message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect)." },
        { name: "vitest", message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect)." },
        { name: "@jest/globals", message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect)." },
        { name: "jest", message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect)." },
        { name: "mocha", message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect)." },
      ],
      patterns: [
        { group: ["vitest/*", "jest/*", "mocha/*"], message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect)." },
      ],
    },
  ],
  "no-restricted-modules": [
    "error",
    { paths: ["bun:test", "vitest", "@jest/globals", "jest", "mocha"], patterns: ["vitest/*", "jest/*", "mocha/*"] },
  ],
};
