import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import type { GoodGirlConfig } from "@goodgirl/shared";
import { createPlaywrightConfig } from "./src/config.js";

let parsedConfig: Partial<GoodGirlConfig> | undefined;

if (process.env.GOODGIRL_CONFIG_JSON) {
  try {
    parsedConfig = JSON.parse(process.env.GOODGIRL_CONFIG_JSON) as Partial<GoodGirlConfig>;
  } catch {
    // Fall back to reading file
  }
}

if (!parsedConfig) {
  // Check if cwd has goodgirl.config.json or ts
  const jsonCandidate = resolve(process.cwd(), "goodgirl.config.json");
  if (existsSync(jsonCandidate)) {
    try {
      parsedConfig = JSON.parse(readFileSync(jsonCandidate, "utf-8")) as Partial<GoodGirlConfig>;
    } catch {
      // Continue with defaults
    }
  }
}

export default defineConfig(createPlaywrightConfig(process.cwd(), parsedConfig));
