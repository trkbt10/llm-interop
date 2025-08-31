#!/usr/bin/env bun
/**
 * @file Main script to capture real API responses from all providers
 * Runs all provider-specific API capture scripts in sequence
 * Requires API keys to be set in environment variables
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

type ScriptResult = {
  provider: string;
  success: boolean;
  error?: string;
};

async function runScript(scriptPath: string, provider: string): Promise<ScriptResult> {
  return new Promise((resolve) => {
    const child = spawn("bun", [scriptPath], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ provider, success: true });
      } else {
        resolve({ provider, success: false, error: `Exit code: ${code}` });
      }
    });

    child.on("error", (error) => {
      resolve({ provider, success: false, error: error.message });
    });
  });
}

async function checkEnvironmentVariables() {
  const missing: string[] = [];

  if (!process.env.OPENAI_API_KEY) {
    missing.push("OPENAI_API_KEY for OpenAI");
  }
  if (!process.env.OPENAI_MODEL) {
    missing.push("OPENAI_MODEL for OpenAI");
  }

  if (!process.env.GOOGLE_AI_STUDIO_API_KEY && !process.env.GEMINI_API_KEY) {
    missing.push("GOOGLE_AI_STUDIO_API_KEY or GEMINI_API_KEY for Gemini");
  }
  if (!process.env.GEMINI_MODEL) {
    missing.push("GEMINI_MODEL for Gemini");
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
    missing.push("ANTHROPIC_API_KEY or CLAUDE_API_KEY for Claude");
  }
  if (!process.env.CLAUDE_MODEL) {
    missing.push("CLAUDE_MODEL for Claude");
  }

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    for (const key of missing) {
      console.error(`   - ${key}`);
    }
    console.error("\nPlease set the required API keys and try again.");
    process.exit(1);
  }

  console.log("✅ All required environment variables are set\n");
}

async function main() {
  console.log("🚀 Starting real API response capture for all providers...\n");

  await checkEnvironmentVariables();

  const scripts = [
    { path: join(__dirname, "mock-generators", "openai.ts"), provider: "OpenAI" },
    { path: join(__dirname, "mock-generators", "gemini.ts"), provider: "Gemini" },
    { path: join(__dirname, "mock-generators", "claude.ts"), provider: "Claude" },
  ];

  const results: ScriptResult[] = [];

  for (const script of scripts) {
    console.log(`📡 Capturing ${script.provider} API responses...`);
    const result = await runScript(script.path, script.provider);
    results.push(result);

    if (result.success) {
      console.log(`✅ ${script.provider} completed successfully\n`);
    } else {
      console.log(`❌ ${script.provider} failed: ${result.error}\n`);
    }
  }

  // Summary
  console.log("📊 Capture Summary:");
  console.log("=".repeat(50));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  for (const result of successful) {
    console.log(`✅ ${result.provider} - Success`);
  }

  for (const result of failed) {
    console.log(`❌ ${result.provider} - Failed: ${result.error}`);
  }

  console.log(`\n📈 Total: ${successful.length}/${results.length} providers completed successfully`);

  if (failed.length > 0) {
    console.log("\n⚠️  Some providers failed to capture API responses. Check the logs above.");
    console.log("💡 Make sure all API keys are valid and have sufficient credits/quota.");
    process.exit(1);
  } else {
    console.log("\n🎉 All API response capture completed successfully!");
    console.log("📁 Raw responses saved to __mocks__/raw/[provider]/");
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}
