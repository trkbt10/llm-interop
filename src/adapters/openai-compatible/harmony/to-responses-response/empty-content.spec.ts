/**
 * @file Test cases for empty content handling in Harmony to Responses converter
 */

import { convertHarmonyToResponses } from "./converter";
import type { HarmonyMessage } from "../types";

describe("Empty Content Handling", () => {
  it("should handle completely empty content", async () => {
    const message: HarmonyMessage = {
      role: "assistant",
      content: "",
    };

    const events = await convertHarmonyToResponses(message);

    // Should have at least created and completed events
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("response.created");
    expect(events[1].type).toBe("response.completed");

    // The completed event should have empty output
    const completed = events[1];
    if (completed.type === "response.completed") {
      expect(completed.response.output).toEqual([]);
      expect(completed.response.output_text).toBe("");
    }
  });

  it("should handle null content", async () => {
    // Test edge case with invalid content - using type guard pattern
    const createTestMessage = (content: unknown): HarmonyMessage => {
      return {
        role: "assistant",
        content: content as string,
      };
    };

    const message = createTestMessage(null);

    const events = await convertHarmonyToResponses(message);

    // Should have at least created and completed events
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("response.created");
    expect(events[1].type).toBe("response.completed");
  });

  it("should handle undefined content", async () => {
    // Test edge case with missing content - using type guard pattern
    const createTestMessage = (content: unknown): HarmonyMessage => {
      return {
        role: "assistant",
        content: content as string,
      };
    };

    const message = createTestMessage(undefined);

    const events = await convertHarmonyToResponses(message);

    // Should have at least created and completed events
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("response.created");
    expect(events[1].type).toBe("response.completed");
  });

  it("should handle whitespace-only content", async () => {
    const message: HarmonyMessage = {
      role: "assistant",
      content: "   \n  \t  ",
    };

    const events = await convertHarmonyToResponses(message);

    // Whitespace gets normalized to empty, so should only have created/completed
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("response.created");
    expect(events[1].type).toBe("response.completed");
  });

  it("should still include tool calls even with empty content", async () => {
    const message: HarmonyMessage = {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "test_call",
          type: "function",
          function: {
            name: "test_function",
            arguments: '{"test": true}',
          },
        },
      ],
    };

    const events = await convertHarmonyToResponses(message);

    // Should have more events due to tool call
    expect(events.length).toBeGreaterThan(2);

    // Should have tool call events
    const toolCallAdded = events.find(e => e.type === "response.output_item.added");
    expect(toolCallAdded).toBeDefined();

    const toolCallDone = events.find(e => e.type === "response.function_call_arguments.done");
    expect(toolCallDone).toBeDefined();
  });
});