#!/usr/bin/env bun
/**
 * @file Claude real API response capture script
 * Captures actual Anthropic Claude API responses
 * Supports both streaming and non-streaming with tool calls
 */

import { prepareJsonlWriter } from "../../src/utils/jsonl/helpers";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;

if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable is required");
}

const client = new Anthropic({ apiKey });

const BASE_DIR = "__mocks__/raw/claude";
const MODEL = process.env.CLAUDE_MODEL;
if (!MODEL) {
  throw new Error("CLAUDE_MODEL environment variable is required");
}

// Type assertion to ensure MODEL is string after the check
const model: string = MODEL;

const testMessages = [
  "Hello! How are you today?",
  "What's the weather like in San Francisco?",
  "Can you help me calculate 15 * 23?",
  "Tell me a short story about a robot.",
];

const weatherTool = {
  name: "get_weather",
  description: "Get current weather information for a location",
  input_schema: {
    type: "object" as const,
    properties: {
      location: {
        type: "string" as const,
        description: "The city and country, e.g. San Francisco, CA",
      },
      unit: {
        type: "string" as const,
        enum: ["celsius", "fahrenheit"] as const,
        description: "Temperature unit",
      },
    },
    required: ["location"] as string[],
  },
};

const calculatorTool = {
  name: "calculate",
  description: "Perform basic arithmetic calculations",
  input_schema: {
    type: "object" as const,
    properties: {
      expression: {
        type: "string" as const,
        description: "The mathematical expression to evaluate, e.g. '15 * 23'",
      },
    },
    required: ["expression"] as string[],
  },
};

async function captureMessages(baseDir: string, model: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }
  if (!model) {
    throw new Error("model is required");
  }

  const { writer } = await prepareJsonlWriter(baseDir, "message-sync.jsonl");
  if (!writer) return;

  try {
    console.log("🔄 Capturing Claude Messages (sync)...");

    // Simple text messages
    for (const message of testMessages) {
      const response = await client.messages.create({
        model,
        max_tokens: 1000,

        messages: [{ role: "user", content: message }],
      });
      await writer.write(response);
      console.log(`✓ Captured simple message: ${message.slice(0, 30)}...`);
    }

    // Tool call message
    const toolResponse = await client.messages.create({
      model,
      max_tokens: 1000,

      messages: [{ role: "user", content: "What's the weather like in Tokyo?" }],
      tools: [weatherTool],
    });
    await writer.write(toolResponse);
    console.log("✓ Captured tool call message");

    // Multi-tool message
    const multiToolResponse = await client.messages.create({
      model,
      max_tokens: 1000,

      messages: [{ role: "user", content: "What's the weather in NYC and calculate 42 * 17?" }],
      tools: [weatherTool, calculatorTool],
    });
    await writer.write(multiToolResponse);
    console.log("✓ Captured multi-tool message");

    // Tool result conversation
    const toolResultResponse = await client.messages.create({
      model,
      max_tokens: 1000,

      messages: [
        { role: "user", content: "Get the weather for London" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll get the weather information for London." },
            {
              type: "tool_use",
              id: "toolu_weather_london",
              name: "get_weather",
              input: { location: "London, UK", unit: "celsius" },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_weather_london",
              content: JSON.stringify({
                temperature: 8,
                condition: "cloudy",
                humidity: 82,
                wind_speed: 12,
              }),
            },
          ],
        },
      ],
      tools: [weatherTool],
    });
    await writer.write(toolResultResponse);
    console.log("✓ Captured tool result message");

    // Image analysis message (with base64 image)
    const imageResponse = await client.messages.create({
      model,
      max_tokens: 1000,

      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What do you see in this image?" },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                // Small 1x1 transparent PNG
                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAUwl9GQAAAABJRU5ErkJggg==",
              },
            },
          ],
        },
      ],
    });
    await writer.write(imageResponse);
    console.log("✓ Captured image analysis message");
  } finally {
    await writer.close();
  }
}

async function captureStreamingMessages(baseDir: string, model: string) {
  if (!baseDir) {
    throw new Error("baseDir is required");
  }
  if (!model) {
    throw new Error("model is required");
  }

  const { writer } = await prepareJsonlWriter(baseDir, "message-stream.jsonl");
  if (!writer) return;

  try {
    console.log("🔄 Capturing Claude Messages (streaming)...");

    // Simple streaming
    const stream = await client.messages.create({
      model,
      max_tokens: 500,

      messages: [{ role: "user", content: "Tell me a story about artificial intelligence in 3 paragraphs." }],
      stream: true,
    });

    for await (const event of stream) {
      await writer.write(event);
    }
    console.log("✓ Captured simple streaming message");

    // Tool call streaming
    const toolStream = await client.messages.create({
      model,
      max_tokens: 500,

      messages: [{ role: "user", content: "Get the weather for Paris, France and explain what the conditions mean" }],
      tools: [weatherTool],
      stream: true,
    });

    for await (const event of toolStream) {
      await writer.write(event);
    }
    console.log("✓ Captured tool call streaming message");

    // Multi-tool streaming
    const multiStream = await client.messages.create({
      model,
      max_tokens: 500,

      messages: [
        {
          role: "user",
          content: "Check weather in Berlin and calculate the square root of 144, then explain both results",
        },
      ],
      tools: [weatherTool, calculatorTool],
      stream: true,
    });

    for await (const event of multiStream) {
      await writer.write(event);
    }
    console.log("✓ Captured multi-tool streaming message");

    // Tool result streaming conversation
    const toolResultStream = await client.messages.create({
      model,
      max_tokens: 500,

      messages: [
        { role: "user", content: "Get the weather for Madrid" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll check the weather in Madrid for you." },
            {
              type: "tool_use",
              id: "toolu_weather_madrid",
              name: "get_weather",
              input: { location: "Madrid, Spain", unit: "celsius" },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_weather_madrid",
              content: JSON.stringify({
                temperature: 15,
                condition: "sunny",
                humidity: 45,
                wind_speed: 8,
              }),
            },
          ],
        },
      ],
      tools: [weatherTool],
      stream: true,
    });

    for await (const event of toolResultStream) {
      await writer.write(event);
    }
    console.log("✓ Captured tool result streaming message");
  } finally {
    await writer.close();
  }
}

async function main() {
  try {
    console.log("🚀 Starting Claude API response capture...");
    console.log(`📋 Using model: ${model}\n`);

    await captureMessages(BASE_DIR, model);
    await captureStreamingMessages(BASE_DIR, model);

    console.log("\n🎉 Claude API response capture completed successfully!");
  } catch (error) {
    console.error("❌ Failed to capture Claude API responses:");
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
