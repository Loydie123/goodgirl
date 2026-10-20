#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const cliEntry = join(rootDir, "apps", "cli", "dist", "index.js");

// If CLI build output does not exist, build it first
if (!existsSync(cliEntry)) {
  console.log("GoodGirl CLI not yet built. Building workspace...");
  const buildResult = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["build"],
    {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (buildResult.status !== 0) {
    process.exit(buildResult.status ?? 1);
  }
}

// Forward args directly to the CLI entry point
const args = process.argv.slice(2);
const runResult = spawnSync(process.execPath, [cliEntry, ...args], {
  cwd: process.cwd(),
  stdio: "inherit",
});

process.exit(runResult.status ?? (runResult.error ? 1 : 0));
