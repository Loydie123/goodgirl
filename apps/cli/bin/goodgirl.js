#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = join(__dirname, "..", "dist", "index.js");

if (!existsSync(distPath)) {
  console.error(
    "GoodGirl CLI distribution build not found. Please run `pnpm build` first.",
  );
  process.exit(1);
}

await import("../dist/index.js");
