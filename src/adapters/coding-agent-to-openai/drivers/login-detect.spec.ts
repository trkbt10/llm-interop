/**
 * @file tests for login detection (vitest globals)
 */
import { isLoginRequired, assertNoLoginPromptOrThrow } from "./login-detect";

describe("login-detect", () => {
  it("detects typical login prompts", () => {
    const text = "Please login: run mycli login to authenticate";
    expect(isLoginRequired(text)).toBe(true);
  });
  it("does not flag normal output", () => {
    const text = "Task completed successfully";
    expect(isLoginRequired(text)).toBe(false);
  });
  it("assertNoLoginPromptOrThrow throws on login prompt", () => {
    expect(() => assertNoLoginPromptOrThrow("", "Sign in required. Run tool login.")).toThrow();
  });
});

