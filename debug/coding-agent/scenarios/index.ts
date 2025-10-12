/**
 * @file Scenario runner entry point
 * Runs all scenarios and collects results
 */
import type { OpenAICompatibleClient } from "../../../src/adapters/openai-client-types";
import { createJsonlWriter } from "../../../src/utils/jsonl/writer";
import { createLogDirectory } from "../../fetch/support/log-utils";
import { runChatSyncText } from "./01-chat-sync-text";
import { runChatStreamText } from "./02-chat-stream-text";
import { runChatSyncJson } from "./03-chat-sync-json";
import { runChatStreamJson } from "./04-chat-stream-json";
import { runChatSyncJsonSchema } from "./05-chat-sync-json-schema";
import { runChatStreamJsonSchema } from "./06-chat-stream-json-schema";
import { runChatSyncTextTool } from "./07-chat-sync-text-tool";
import { runChatStreamTextTool } from "./08-chat-stream-text-tool";
import { runResponsesSyncText } from "./09-responses-sync-text";
import { runResponsesStreamText } from "./10-responses-stream-text";
import { runResponsesSyncJson } from "./11-responses-sync-json";
import { runResponsesStreamJson } from "./12-responses-stream-json";
import { runResponsesSyncJsonSchema } from "./13-responses-sync-json-schema";
import { runResponsesStreamJsonSchema } from "./14-responses-stream-json-schema";
import { runResponsesSyncTextTool } from "./15-responses-sync-text-tool";
import { runResponsesStreamTextTool } from "./16-responses-stream-text-tool";
import type { ScenarioResult } from "./types";

type ScenarioFunction = (client: OpenAICompatibleClient) => Promise<ScenarioResult>;

const scenarios: Array<{ name: string; fn: ScenarioFunction }> = [
  { name: "01-chat-sync-text", fn: runChatSyncText },
  { name: "02-chat-stream-text", fn: runChatStreamText },
  { name: "03-chat-sync-json", fn: runChatSyncJson },
  { name: "04-chat-stream-json", fn: runChatStreamJson },
  { name: "05-chat-sync-json-schema", fn: runChatSyncJsonSchema },
  { name: "06-chat-stream-json-schema", fn: runChatStreamJsonSchema },
  { name: "07-chat-sync-text-tool", fn: runChatSyncTextTool },
  { name: "08-chat-stream-text-tool", fn: runChatStreamTextTool },
  { name: "09-responses-sync-text", fn: runResponsesSyncText },
  { name: "10-responses-stream-text", fn: runResponsesStreamText },
  { name: "11-responses-sync-json", fn: runResponsesSyncJson },
  { name: "12-responses-stream-json", fn: runResponsesStreamJson },
  { name: "13-responses-sync-json-schema", fn: runResponsesSyncJsonSchema },
  { name: "14-responses-stream-json-schema", fn: runResponsesStreamJsonSchema },
  { name: "15-responses-sync-text-tool", fn: runResponsesSyncTextTool },
  { name: "16-responses-stream-text-tool", fn: runResponsesStreamTextTool },
];

/**
 * Run all scenarios sequentially and log results
 * @param client - OpenAI-compatible client instance
 * @param label - Label for log directory (e.g., "claude-code", "codex-cli")
 */
export const runScenarios = async (client: OpenAICompatibleClient, label: string): Promise<void> => {
  const logDir = createLogDirectory(`coding-agent-${label}`);

  console.log(`[coding-agent] Running scenarios for ${label}`);
  console.log(`[coding-agent] Log directory: ${logDir}`);

  const results: Array<ScenarioResult & { error?: string }> = [];

  for (const scenario of scenarios) {
    console.log(`\n=== Running: ${scenario.name} ===`);
    try {
      const result = await scenario.fn(client);
      results.push(result);

      if (result.success) {
        console.log(`✓ ${scenario.name} PASSED`);
      } else {
        console.log(`✗ ${scenario.name} FAILED`);
      }

      if (result.output) {
        console.log("Output:");
        console.log(result.output);
      }

      const writer = createJsonlWriter(`${logDir}/${scenario.name}.jsonl`);
      await writer.write(result.rawResponse);
      await writer.close();
      console.log(`Logged to: ${logDir}/${scenario.name}.jsonl`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${scenario.name} ERROR: ${errorMessage}`);
      results.push({
        scenario: scenario.name,
        success: false,
        output: null,
        rawResponse: null,
        error: errorMessage,
      });
    }
  }

  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  const summaryWriter = createJsonlWriter(`${logDir}/summary.jsonl`);
  await summaryWriter.write({
    label,
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    results: results.map((r) => ({
      scenario: r.scenario,
      success: r.success,
      error: r.error,
    })),
  });
  await summaryWriter.close();
  console.log(`\nSummary logged to: ${logDir}/summary.jsonl`);
};
