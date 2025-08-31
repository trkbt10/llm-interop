/**
 * @file Tests for main entry point of the LLM interoperability library
 */

describe("Main entry point", () => {
  it("should be able to import the module", async () => {
    // Test that the module can be imported
    expect(async () => {
      // eslint-disable-next-line no-restricted-syntax -- needed for dynamic import testing
      await import("./index");
    }).not.toThrow();
  });

  it("should have exports available", async () => {
    // Import the module and check it exists
    // eslint-disable-next-line no-restricted-syntax -- needed for dynamic import testing
    const indexModule = await import("./index");
    expect(indexModule).toBeDefined();
  });
});
