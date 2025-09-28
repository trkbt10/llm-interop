/**
 * @file Tests for Harmony response parser.
 */
import { parseHarmonyResponse } from "./parse-response";
import { createHarmonyStreamParser } from "./stream-parser";
import { HARMONY_CHANNELS } from "../constants";
import type { HarmonyMessage } from "../types";

describe("HarmonyResponseParser", () => {
  describe("parseResponse", () => {
    it("parses plain assistant content", async () => {
      const message: HarmonyMessage = {
        role: "assistant",
        content: "Hello, world!",
      };

      const result = await parseHarmonyResponse(message);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        channel: HARMONY_CHANNELS.FINAL,
        content: "Hello, world!",
        isToolCall: false,
        stopReason: "return",
      });
      expect(result.reasoning).toBeUndefined();
      expect(result.toolCalls).toBeUndefined();
    });

    it("parses analysis and final channels following the spec", async () => {
      const message: HarmonyMessage = {
        role: "assistant",
        content: [
          "<|start|>assistant",
          "<|channel|>analysis",
          "<|message|>Working through the steps",
          "<|end|>",
          "<|start|>assistant",
          "<|channel|>final",
          "<|message|>All done!",
          "<|return|>",
        ].join(""),
      };

      const result = await parseHarmonyResponse(message);
      expect(result.messages).toHaveLength(2);

      expect(result.messages[0]).toMatchObject({
        channel: HARMONY_CHANNELS.ANALYSIS,
        content: "Working through the steps",
        stopReason: "end",
      });
      expect(result.messages[1]).toMatchObject({
        channel: HARMONY_CHANNELS.FINAL,
        content: "All done!",
        stopReason: "return",
      });

      expect(result.reasoning).toBe("Working through the steps");
    });

    it("parses harmony tool calls and normalises metadata", async () => {
      const message: HarmonyMessage = {
        role: "assistant",
        content: [
          "<|start|>assistant",
          "<|channel|>commentary to=functions.get_weather",
          "<|constrain|>json",
          "<|message|>{\"location\":\"Tokyo\"}",
          "<|call|>",
        ].join(""),
      };

      const result = await parseHarmonyResponse(message);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        channel: HARMONY_CHANNELS.COMMENTARY,
        constrainType: "json",
        recipient: "functions.get_weather",
        isToolCall: true,
        stopReason: "call",
      });

      expect(result.toolCalls).toEqual([
        {
          id: "fc_0001",
          name: "get_weather",
          arguments: '{"location":"Tokyo"}',
        },
      ]);
    });

    it("prefers explicit reasoning field when provided", async () => {
      const message: HarmonyMessage = {
        role: "assistant",
        content: [
          "<|start|>assistant",
          "<|channel|>analysis",
          "<|message|>internal thoughts",
          "<|end|>",
        ].join(""),
        reasoning: "external reasoning",
      };

      const result = await parseHarmonyResponse(message);
      expect(result.reasoning).toBe("external reasoning");
    });

    it("normalises OpenAI tool_calls array when present", async () => {
      const message: HarmonyMessage = {
        role: "assistant",
        content: "Let's call a tool.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location":"SF"}',
            },
          },
        ],
      };

      const result = await parseHarmonyResponse(message);
      expect(result.toolCalls).toEqual([
        { id: "call_123", name: "get_weather", arguments: '{"location":"SF"}' },
      ]);
    });
  });

  describe("HarmonyStreamParser", () => {
    it("emits frames as soon as messages complete", () => {
      const streamParser = createHarmonyStreamParser();

      const frames = [
        ...streamParser.push("<|start|>assistant<|channel|>analysis"),
        ...streamParser.push("<|message|>Thinking"),
        ...streamParser.push("<|end|>"),
        ...streamParser.push("<|start|>assistant<|channel|>final"),
        ...streamParser.push("<|message|>Done"),
        ...streamParser.push("<|return|>"),
        ...streamParser.flush(),
      ];

      const messages = frames.map((frame) => frame.message);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        channel: HARMONY_CHANNELS.ANALYSIS,
        content: "Thinking",
        stopReason: "end",
      });
      expect(messages[1]).toMatchObject({
        channel: HARMONY_CHANNELS.FINAL,
        content: "Done",
        stopReason: "return",
      });
    });

    it("creates a fallback final message for plain text streams", () => {
      const streamParser = createHarmonyStreamParser();
      streamParser.push("Plain response");
      const frames = streamParser.flush();

      expect(frames).toHaveLength(1);
      expect(frames[0].message).toMatchObject({
        channel: HARMONY_CHANNELS.FINAL,
        content: "Plain response",
        stopReason: "return",
      });
    });
  });
});
