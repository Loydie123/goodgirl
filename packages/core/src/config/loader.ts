import { createJiti } from "jiti";
import { ConfigError, resolveConfigPath } from "@goodgirl/shared";
import { goodGirlConfigSchema, type ValidatedGoodGirlConfig } from "./schema.js";

function applyEnvironmentOverrides(rawConfig: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...rawConfig };

  if (process.env.GOODGIRL_BASE_URL) {
    merged.baseURL = process.env.GOODGIRL_BASE_URL;
  }
  if (process.env.GOODGIRL_BROWSER) {
    merged.browser = process.env.GOODGIRL_BROWSER;
  }
  if (process.env.GOODGIRL_BROWSERS) {
    const list = process.env.GOODGIRL_BROWSERS.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) {
      merged.browsers = list;
    }
  }
  if (process.env.GOODGIRL_TIMEOUT) {
    const parsed = Number.parseInt(process.env.GOODGIRL_TIMEOUT, 10);
    if (!Number.isNaN(parsed)) {
      merged.timeout = parsed;
    }
  }
  if (process.env.GOODGIRL_RETRIES) {
    const parsed = Number.parseInt(process.env.GOODGIRL_RETRIES, 10);
    if (!Number.isNaN(parsed)) {
      merged.retries = parsed;
    }
  }
  if (process.env.GOODGIRL_WORKERS) {
    const parsed = Number.parseInt(process.env.GOODGIRL_WORKERS, 10);
    merged.workers = Number.isNaN(parsed) ? process.env.GOODGIRL_WORKERS : parsed;
  }
  if (process.env.GOODGIRL_FULLY_PARALLEL) {
    merged.fullyParallel =
      process.env.GOODGIRL_FULLY_PARALLEL === "true" ||
      process.env.GOODGIRL_FULLY_PARALLEL === "1";
  }
  if (process.env.GOODGIRL_VIDEO) {
    merged.video = process.env.GOODGIRL_VIDEO;
  }
  if (process.env.GOODGIRL_TRACE) {
    merged.trace = process.env.GOODGIRL_TRACE;
  }
  if (process.env.GOODGIRL_SCREENSHOTS) {
    merged.screenshots = process.env.GOODGIRL_SCREENSHOTS;
  }

  return merged;
}

export async function loadGoodGirlConfig(
  cwd: string,
  explicitPath?: string,
): Promise<{ config: ValidatedGoodGirlConfig; configPath: string | null }> {
  const configPath = resolveConfigPath(cwd, explicitPath);

  let rawConfig: Record<string, unknown> = {};

  if (configPath) {
    try {
      const jiti = createJiti(cwd, {
        interopDefault: true,
      });
      const imported = (await jiti.import(configPath)) as
        | { default?: Record<string, unknown> }
        | Record<string, unknown>;

      rawConfig = (imported && typeof imported === "object" && "default" in imported && imported.default
        ? imported.default
        : imported) as Record<string, unknown>;
    } catch (err) {
      throw new ConfigError(
        `Failed to load configuration file at "${configPath}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const withEnv = applyEnvironmentOverrides(rawConfig);
  const result = goodGirlConfigSchema.safeParse(withEnv);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((e) => `  - [${e.path.join(".") || "root"}]: ${e.message}`)
      .join("\n");
    throw new ConfigError(
      `Invalid GoodGirl configuration:\n${formattedErrors}`,
    );
  }

  return {
    config: result.data,
    configPath,
  };
}
