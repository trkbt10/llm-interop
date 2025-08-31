/**
 * @file Tests for conversation state handling.
 */
import { handleConversationState, processAssistantMessage } from "./handle-conversation-state";
import type { ResponseCreateParamsBase } from "../../types";

describe("handleConversationState", () => {
  it("should return empty array when no input", () => {
    const params: ResponseCreateParamsBase = {};
    expect(handleConversationState(params)).toEqual([]);
  });

  it("should convert string input to messages", () => {
    const params: ResponseCreateParamsBase = {
      input: "Hello world",
    };
    const result = handleConversationState(params);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("Hello world");
  });

  it("should convert array input to messages", () => {
    const params: ResponseCreateParamsBase = {
      input: [
        { type: "message", role: "user", content: "Question" },
        { type: "message", role: "assistant", content: "Answer" },
      ],
    };
    const result = handleConversationState(params);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("Question");
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toContain("Answer");
  });

  it("should handle previous_response_id parameter", () => {
    // Note: This test currently logs a warning to console
    // In production, previous_response_id would be handled by the caller
    const params: ResponseCreateParamsBase = {
      previous_response_id: "resp_123",
      input: "Test",
    };
    const result = handleConversationState(params);

    // Should still process input normally
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain("Test");
  });

  it("should handle both previous_response_id and input", () => {
    // Note: This test currently logs a warning to console
    // In production, previous_response_id would be handled by the caller
    const params: ResponseCreateParamsBase = {
      previous_response_id: "resp_456",
      input: [{ type: "message", role: "user", content: "New question" }],
    };
    const result = handleConversationState(params);

    // Should still process input normally
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain("New question");
  });
});

describe("processAssistantMessage", () => {
  it("should replace <|return|> with <|end|>", () => {
    const content = "<|start|>assistant<|channel|>final<|message|>Answer<|return|>";
    const result = processAssistantMessage(content);

    expect(result).toBe("<|start|>assistant<|channel|>final<|message|>Answer<|end|>");
  });

  it("should not modify messages without <|return|>", () => {
    const content = "<|start|>assistant<|channel|>final<|message|>Answer<|end|>";
    const result = processAssistantMessage(content);

    expect(result).toBe(content);
  });

  it("should handle analysis channel content", () => {
    const content = "<|start|>assistant<|channel|>analysis<|message|>Thinking...<|end|>";
    const result = processAssistantMessage(content);

    expect(result).toBe(content);
  });

  it("should handle empty content", () => {
    expect(processAssistantMessage("")).toBe("");
  });

  it("should only replace <|return|> at the end", () => {
    const content = "Some <|return|> in middle<|return|>";
    const result = processAssistantMessage(content);

    expect(result).toBe("Some <|return|> in middle<|end|>");
  });
});
