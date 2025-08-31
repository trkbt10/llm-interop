import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import jsdocPlugin from "eslint-plugin-jsdoc";
import eslintComments from "eslint-plugin-eslint-comments";
import prettierConfig from "eslint-config-prettier";
import customPlugin from "./eslint/plugins/custom/index.js";
import rulesJSDoc from "./eslint/rules/rules-jsdoc.js";
import rulesRestrictedSyntax from "./eslint/rules/rules-restricted-syntax.js";
import rulesCurly from "./eslint/rules/rules-curly.js";
import rulesTestAndMocksImports, { allowMocksRuleSet } from "./eslint/rules/rules-test-and-mocks-imports.js";
import rulesNoMocks from "./eslint/rules/rules-no-mocks.js";

export default [
  { ignores: ["node_modules/**", "dist/**", "build/**", "*.config.ts", ".code_styles/**", "samples/**", "scripts/**"] },

  ...tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,

    {
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      plugins: {
        import: importPlugin,
        jsdoc: jsdocPlugin,
        "eslint-comments": eslintComments,
        "@typescript-eslint": tseslint.plugin,
        custom: customPlugin,
      },
      settings: {
        jsdoc: { mode: "typescript" },
      },
      rules: {
        "custom/ternary-length": "error",
        "custom/no-and-as-ternary": "error",
        "custom/prefer-node-protocol": "error",
        "custom/no-as-outside-guard": "error",
        "custom/no-nested-try": "error",
        ...rulesJSDoc,
        ...rulesRestrictedSyntax,
        ...rulesCurly,
        ...rulesTestAndMocksImports,
        ...rulesNoMocks,
      },
    },
    {
      files: ["**/*.spec.ts", "**/*.spec.tsx"],
      languageOptions: {
        globals: {
          describe: "readonly",
          it: "readonly",
          test: "readonly",
          expect: "readonly",
          beforeAll: "readonly",
          afterAll: "readonly",
          beforeEach: "readonly",
          afterEach: "readonly",
          suite: "readonly",
          bench: "readonly",
        },
      },
      rules: allowMocksRuleSet,
    },
    { files: ["__mocks__/**", "src/**/__mocks__/**"], rules: allowMocksRuleSet },
    {
      files: ["eslint/**"],
      rules: {
        "custom/ternary-length": "off",
        "custom/no-and-as-ternary": "off",
        "custom/no-as-outside-guard": "off",
        "custom/no-nested-try": "off",
      },
    },
  ),
];
