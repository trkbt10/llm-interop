#!/usr/bin/env node
/**
 * @file Documentation compiler - Generates README.md from modular documentation
 *
 * This script compiles README.md from curated markdown files under docs/readme.
 *
 * Features:
 * - Concatenates specific markdown files in a fixed order (curated list)
 * - Template variable replacement from package.json and git
 * - Check mode for CI/lint validation
 *
 * Usage:
 * - Build: npm run docs:build
 * - Check: npm run docs:check
 *
 * Template variables available:
 * - {{NAME}} - Package name from package.json
 * - {{VERSION}} - Package version
 * - {{DESCRIPTION}} - Package description
 * - {{AUTHOR}} - Package author
 * - {{LICENSE}} - Package license
 * - {{HOMEPAGE}} - Package homepage
 * - {{REPOSITORY}} - Package repository
 * - {{GIT_ORIGIN}} - Git origin URL (converted to HTTPS)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const isCheckMode = process.argv.includes("--check");

const root = process.cwd();
const outFile = path.join(root, "README.md");
const baseDir = path.join(root, "docs", "readme");

async function getGitOrigin() {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"]);
    let origin = stdout.trim();
    if (origin.startsWith("git@github.com:")) {
      origin = origin.replace("git@github.com:", "https://github.com/").replace(".git", "");
    }
    return origin;
  } catch {
    return "";
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function replaceTemplatesFactory(vars) {
  return function replaceTemplates(content) {
    return content.replace(/\{\{([A-Z_]+)\}\}/g, (match, varName) => {
      return vars[varName] !== undefined ? vars[varName] : match;
    });
  };
}

async function buildCombinedMarkdown(filePaths, replaceTemplates) {
  const parts = await Promise.all(
    filePaths.map(async (p) => {
      const content = await fs.readFile(p, "utf8");
      return replaceTemplates(content.trim()) + "\n";
    }),
  );
  return parts.join("\n");
}

async function discoverFiles() {
  if (!(await pathExists(baseDir))) {
    console.error(`Missing directory: ${path.relative(root, baseDir)}`);
    process.exitCode = 1;
    return [];
  }
  const entries = await fs.readdir(baseDir);
  // Pick markdown files that start with a number prefix (e.g., 00-, 10-)
  const md = entries.filter((f) => /^\d+.*\.md$/i.test(f));
  // Sort lexicographically which works with zero-padded prefixes
  md.sort((a, b) => a.localeCompare(b, "en"));
  return md.map((f) => path.join(baseDir, f));
}

async function main() {
  // Discover files dynamically from docs/readme
  const files = await discoverFiles();
  if (!files.length) {
    console.error(`No markdown files found in ${path.relative(root, baseDir)}`);
    process.exitCode = 1;
    return;
  }

  // Load package.json and git info
  const packageJsonContent = await fs.readFile(path.join(root, "package.json"), "utf8");
  const packageJson = JSON.parse(packageJsonContent);
  const gitOrigin = await getGitOrigin();

  const templateVars = {
    NAME: packageJson.name,
    VERSION: packageJson.version,
    DESCRIPTION: packageJson.description || "",
    AUTHOR: packageJson.author || "",
    LICENSE: packageJson.license || "",
    HOMEPAGE: packageJson.homepage || "",
    REPOSITORY: packageJson.repository?.url || packageJson.repository || "",
    GIT_ORIGIN: gitOrigin,
  };
  const replaceTemplates = replaceTemplatesFactory(templateVars);

  const combined = await buildCombinedMarkdown(files, replaceTemplates);

  if (isCheckMode) {
    // Check mode: verify if README.md is up to date
    if (!(await pathExists(outFile))) {
      console.error(`ERROR: ${path.relative(root, outFile)} does not exist. Run 'npm run docs:build' to generate it.`);
      process.exitCode = 1;
      return;
    }
    const existing = await fs.readFile(outFile, "utf8");
    if (existing !== combined) {
      console.error(`ERROR: ${path.relative(root, outFile)} is out of date. Run 'npm run docs:build' to update it.`);
      process.exitCode = 1;
      return;
    }
    console.log("README.md is up to date.");
    return;
  }

  await fs.writeFile(outFile, combined, "utf8");
  console.log("README generated from:");
  files.forEach((p) => console.log(` - ${path.relative(root, p)}`));
}

// Run the main function
main();
