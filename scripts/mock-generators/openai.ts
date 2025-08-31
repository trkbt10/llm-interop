#!/usr/bin/env bun
/**
 * @file OpenAI real API response capture script
 * Captures actual OpenAI API responses for Chat Completions and Responses API
 * Supports both streaming and non-streaming with tool calls
 */

import { prepareJsonlWriter } from "../../src/utils/jsonl/helpers";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const BASE_DIR = "__mocks__/raw/openai";
const MODEL = process.env.OPENAI_MODEL;
if (!MODEL) {
  throw new Error("OPENAI_MODEL environment variable is required");
}

// Type assertion to ensure MODEL is string after the check
const model: string = MODEL;

const testMessages = [
  { role: "user" as const, content: "Hello! How are you today?" },
  { role: "user" as const, content: "What's the weather like in San Francisco?" },
  { role: "user" as const, content: "Can you help me calculate 15 * 23?" },
];

const weatherTool = {
  type: "function" as const,
  function: {
    name: "get_weather",
    description: "Get current weather information for a location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The city and country, e.g. San Francisco, CA",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit",
        },
      },
      required: ["location"],
    },
  },
};

const calculatorTool = {
  type: "function" as const,
  function: {
    name: "calculate",
    description: "Perform basic arithmetic calculations",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The mathematical expression to evaluate, e.g. '15 * 23'",
        },
      },
      required: ["expression"],
    },
  },
};

// Responses API tool schema (flat fields)
const responsesWeatherTool = {
  type: "function" as const,
  name: "get_weather",
  description: "Get current weather information for a location",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city and country, e.g. San Francisco, CA",
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature unit",
      },
    },
    required: ["location"],
  },
};

const responsesCalculatorTool = {
  type: "function" as const,
  name: "calculate",
  description: "Perform basic arithmetic calculations",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "The mathematical expression to evaluate, e.g. '15 * 23'",
      },
    },
    required: ["expression"],
  },
};

async function captureChatCompletions(baseDir: string, model: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }
  if (!model) {
    throw new Error("model is required");
  }

  const { writer } = await prepareJsonlWriter(baseDir, "chat-sync.jsonl");
  if (!writer) return;

  try {
    console.log("🔄 Capturing Chat Completions (sync)...");

    // Simple text completions
    for (const message of testMessages) {
      const response = await client.chat.completions.create({
        model,
        messages: [message],
      });
      await writer.write(response);
      console.log(`✓ Captured simple completion: ${message.content.slice(0, 30)}...`);
    }

    // Tool call completions
    const toolResponse = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "What's the weather like in Tokyo?" }],
      tools: [weatherTool],
      tool_choice: "auto",
    });
    await writer.write(toolResponse);
    console.log("✓ Captured tool call completion");

    // Multi-tool completion
    const multiToolResponse = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "What's the weather in NYC and calculate 42 * 17?" }],
      tools: [weatherTool, calculatorTool],
      tool_choice: "auto",
    });
    await writer.write(multiToolResponse);
    console.log("✓ Captured multi-tool completion");
  } finally {
    await writer.close();
  }
}

async function captureChatCompletionStreaming(baseDir: string, model: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }
  if (!model) {
    throw new Error("model is required");
  }

  const { writer } = await prepareJsonlWriter(baseDir, "chat-stream.jsonl");
  if (!writer) return;

  try {
    console.log("🔄 Capturing Chat Completions (streaming)...");

    // Simple streaming
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Tell me a short story about a robot." }],
      stream: true,
    });

    for await (const chunk of stream) {
      await writer.write(chunk);
    }
    console.log("✓ Captured simple streaming completion");

    // Tool call streaming
    const toolStream = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Get the weather for Paris, France" }],
      tools: [weatherTool],
      tool_choice: "auto",
      stream: true,
    });

    for await (const chunk of toolStream) {
      await writer.write(chunk);
    }
    console.log("✓ Captured tool call streaming completion");
  } finally {
    await writer.close();
  }
}

async function captureResponses(baseDir: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }

  const { writer } = await prepareJsonlWriter(baseDir, "responses-sync.jsonl");
  if (!writer) return;

  try {
    console.log("🔄 Capturing Responses API (sync)...");

    // 1) Simple input
    const simple = await client.responses.create({
      model,
      input: "Write a 1-2 sentence greeting including an emoji.",
    });
    await writer.write(simple);
    console.log("✓ Captured simple response (input)");

    // 2) Messages style
    const messagesStyle = await client.responses.create({
      model,
      input: [{ role: "user", content: "Summarize why testing is important in 1 sentence." }],
    });
    await writer.write(messagesStyle);
    console.log("✓ Captured messages-style response");

    // 3) Tool call (auto)
    const toolAuto = await client.responses.create({
      model,
      input: [{ role: "user", content: "What's the weather in NYC and calculate 42 * 17?" }],
      tools: [responsesWeatherTool, responsesCalculatorTool],
      tool_choice: "auto",
    });
    await writer.write(toolAuto);
    console.log("✓ Captured tool-call response (auto)");
  } finally {
    await writer.close();
  }
}

// Scenario: The assistant requests tool execution (requires_action),
// we submit tool outputs, then continue to final response.
async function captureResponsesToolRoundTrip(baseDir: string) {
  const { writer } = await prepareJsonlWriter(baseDir, "responses-tools-roundtrip.jsonl");
  if (!writer) return;

  try {
    console.log("🔄 Capturing Responses API (tool round-trip)...");

    // Kick off with a prompt that encourages tool use
    const first: any = await client.responses.create({
      model,
      input: [{ role: "user", content: "Get today's weather in Paris and then explain what to wear." }],
      tools: [responsesWeatherTool, responsesCalculatorTool],
      tool_choice: "auto",
    } as any);
    await writer.write(first);

    if (first.status === "requires_action" && first.required_action?.type === "submit_tool_outputs") {
      const calls: any[] = first.required_action.submit_tool_outputs?.tool_calls ?? [];
      const tool_outputs = calls.map((tc: any) => {
        const name = tc?.function?.name ?? "unknown";
        let output: string;
        if (name === "get_weather") {
          output = JSON.stringify({ location: "Paris, France", temperature: 22, unit: "celsius", condition: "sunny" });
        } else if (name === "calculate") {
          output = JSON.stringify({ result: 714, expression: "42 * 17" });
        } else {
          output = JSON.stringify({ ok: true });
        }
        return { tool_call_id: tc.id, output };
      });

      const second: any = await client.responses.submit_tool_outputs(first.id, { tool_outputs } as any);
      await writer.write(second);
      console.log("✓ Submitted tool outputs and captured follow-up");
    } else {
      console.log("ℹ️ No tool action requested in first response");
    }
  } finally {
    await writer.close();
  }
}

async function captureResponsesStreaming(baseDir: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }

  console.log("🔄 Capturing Responses API (streaming) — separate scenarios...");

  // Scenario 1: Simple streaming
  {
    const { writer } = await prepareJsonlWriter(baseDir, "responses-stream-simple.jsonl");
    if (writer) {
      try {
        const stream = await client.responses.stream({
          model,
          input: "Write a limerick about TypeScript.",
        });
        for await (const event of stream) {
          await writer.write(event);
        }
        console.log("✓ Captured simple streaming response → responses-stream-simple.jsonl");
      } finally {
        await writer.close();
      }
    }
  }

  // Scenario 2: Tool call streaming
  {
    const { writer } = await prepareJsonlWriter(baseDir, "responses-stream-tools.jsonl");
    if (writer) {
      try {
        const toolStream = await client.responses.stream({
          model,
          input: [{ role: "user", content: "Get the weather for Paris, France and multiply 13 by 7." }],
          tools: [responsesWeatherTool, responsesCalculatorTool],
          tool_choice: "auto",
        });
        for await (const event of toolStream) {
          await writer.write(event);
        }
        console.log("✓ Captured tool-call streaming response → responses-stream-tools.jsonl");
      } finally {
        await writer.close();
      }
    }
  }
}

async function main() {
  try {
    console.log("🚀 Starting OpenAI API response capture...");
    console.log(`📋 Using model: ${model}\n`);

    await captureChatCompletions(BASE_DIR, model);
    await captureChatCompletionStreaming(BASE_DIR, model);
    await captureResponses(BASE_DIR);
    await captureResponsesToolRoundTrip(BASE_DIR);
    await captureResponsesStreaming(BASE_DIR);

    console.log("\n🎉 OpenAI API response capture completed successfully!");
  } catch (error) {
    console.error("❌ Failed to capture OpenAI API responses:");
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
