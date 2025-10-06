/**
 * @file Test cases for event ordering in Harmony to Responses converter
 */

import { convertHarmonyToResponses } from "./converter";
import type { HarmonyMessage } from "../types";

describe("Event Ordering", () => {
  it("should close reasoning before starting text output", async () => {
    const message: HarmonyMessage = {
      role: "assistant",
      content: "The answer is 42.",
      reasoning: "I calculated this by considering the universe.",
    };

    const events = await convertHarmonyToResponses(message);

    // Find the indices of key events
    const reasoningAddedIndex = events.findIndex(e => {
      if (e.type !== "response.output_item.added") { return false; }
      if (!("item" in e)) { return false; }
      return e.item.type === "reasoning";
    });

    const reasoningTextDoneIndex = events.findIndex(e =>
      e.type === "response.reasoning_text.done"
    );

    const reasoningItemDoneIndex = events.findIndex(e => {
      if (e.type !== "response.output_item.done") { return false; }
      if (!("item" in e)) { return false; }
      return e.item.type === "reasoning";
    });

    const textAddedIndex = events.findIndex(e => {
      if (e.type !== "response.output_item.added") { return false; }
      if (!("item" in e)) { return false; }
      return e.item.type === "message";
    });

    const textDeltaIndex = events.findIndex(e =>
      e.type === "response.output_text.delta"
    );

    const textDoneIndex = events.findIndex(e =>
      e.type === "response.output_text.done"
    );

    const textItemDoneIndex = events.findIndex(e => {
      if (e.type !== "response.output_item.done") { return false; }
      if (!("item" in e)) { return false; }
      return e.item.type === "message";
    });

    // Verify the order
    expect(reasoningAddedIndex).toBeGreaterThan(-1);
    expect(reasoningTextDoneIndex).toBeGreaterThan(reasoningAddedIndex);
    expect(reasoningItemDoneIndex).toBeGreaterThan(reasoningTextDoneIndex);

    // Text events should come after reasoning is completely done
    expect(textAddedIndex).toBeGreaterThan(reasoningItemDoneIndex);
    expect(textDeltaIndex).toBeGreaterThan(textAddedIndex);
    expect(textDoneIndex).toBeGreaterThan(textDeltaIndex);
    expect(textItemDoneIndex).toBeGreaterThan(textDoneIndex);
  });

  it("should follow output_item.added -> content -> output_item.done pattern", async () => {
    const message: HarmonyMessage = {
      role: "assistant",
      content: [
        "<|start|>assistant",
        "<|channel|>analysis",
        "<|message|>Thinking about this...",
        "<|end|>",
        "<|start|>assistant",
        "<|channel|>final",
        "<|message|>Here is my answer.",
        "<|return|>",
      ].join(""),
    };

    const events = await convertHarmonyToResponses(message);

    // Check that each item follows the pattern
    // eslint-disable-next-line no-restricted-syntax -- Need mutable index to track position across multiple assertions in sequence
    let currentIndex = 0;

    // First: response.created
    expect(events[currentIndex].type).toBe("response.created");
    currentIndex++;

    // Reasoning item pattern
    expect(events[currentIndex].type).toBe("response.output_item.added");
    expect(events[currentIndex]).toHaveProperty("item.type", "reasoning");
    currentIndex++;

    // Reasoning content events
    while (events[currentIndex].type === "response.reasoning_text.delta") {
      currentIndex++;
    }

    expect(events[currentIndex].type).toBe("response.reasoning_text.done");
    currentIndex++;

    expect(events[currentIndex].type).toBe("response.output_item.done");
    expect(events[currentIndex]).toHaveProperty("item.type", "reasoning");
    currentIndex++;

    // Text item pattern
    expect(events[currentIndex].type).toBe("response.output_item.added");
    expect(events[currentIndex]).toHaveProperty("item.type", "message");
    currentIndex++;

    // Text content events
    while (events[currentIndex].type === "response.output_text.delta") {
      currentIndex++;
    }

    expect(events[currentIndex].type).toBe("response.output_text.done");
    currentIndex++;

    expect(events[currentIndex].type).toBe("response.output_item.done");
    expect(events[currentIndex]).toHaveProperty("item.type", "message");
    currentIndex++;

    // Finally: response.completed
    expect(events[currentIndex].type).toBe("response.completed");
  });

  it("should handle no reasoning correctly", async () => {
    const message: HarmonyMessage = {
      role: "assistant",
      content: "Just a simple response.",
    };

    const events = await convertHarmonyToResponses(message);

    // Should not have any reasoning events
    const hasReasoningEvents = events.some(e =>
      e.type === "response.reasoning_text.delta" ||
      e.type === "response.reasoning_text.done"
    );

    expect(hasReasoningEvents).toBe(false);

    // Should have text events in correct order
    const textAddedIndex = events.findIndex(e =>
      e.type === "response.output_item.added"
    );
    const textDoneIndex = events.findIndex(e =>
      e.type === "response.output_text.done"
    );
    const textItemDoneIndex = events.findIndex(e =>
      e.type === "response.output_item.done"
    );

    expect(textAddedIndex).toBeGreaterThan(-1);
    expect(textDoneIndex).toBeGreaterThan(textAddedIndex);
    expect(textItemDoneIndex).toBeGreaterThan(textDoneIndex);
  });
});