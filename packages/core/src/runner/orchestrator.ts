import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  ensureDirectoryExists,
  getResultsPaths,
  type TestRunOptions,
  type TestSummary,
} from "@goodgirl/shared";
import { parsePlaywrightJsonReport } from "@goodgirl/reporter";
import { loadGoodGirlConfig } from "../config/loader.js";
import { runSubprocess, type SubprocessResult } from "./subprocess.js";

const require = createRequire(import.meta.url);

export interface OrchestratorRunResult {
  summary: TestSummary;
  subprocess: SubprocessResult;
}

export function resolvePlaywrightCli(): { command: string; args: string[] } {
  try {
    const playwrightPkgPath = require.resolve("@playwright/test/package.json");
    const playwrightDir = dirname(playwrightPkgPath);
    const cliPath = join(playwrightDir, "cli.js");
    if (existsSync(cliPath)) {
      return { command: process.execPath, args: [cliPath] };
    }
  } catch {
    // Fall back to npx
  }

  const isWin = process.platform === "win32";
  return {
    command: isWin ? "npx.cmd" : "npx",
    args: ["playwright"],
  };
}

export function resolvePlaywrightConfigPath(projectDir: string): string {
  const localCandidates = [
    join(projectDir, "playwright.config.ts"),
    join(projectDir, "playwright.config.js"),
    join(projectDir, "playwright.config.mjs"),
  ];
  for (const cand of localCandidates) {
    if (existsSync(cand)) {
      return cand;
    }
  }

  try {
    const pkgPath = require.resolve("@goodgirl/playwright/package.json");
    const builtIn = join(dirname(pkgPath), "playwright.config.ts");
    if (existsSync(builtIn)) {
      return builtIn;
    }
    const builtInJs = join(dirname(pkgPath), "playwright.config.js");
    if (existsSync(builtInJs)) {
      return builtInJs;
    }
  } catch {
    // Continue
  }

  const monorepoBuiltIn = resolve(process.cwd(), "packages", "playwright", "playwright.config.ts");
  if (existsSync(monorepoBuiltIn)) {
    return monorepoBuiltIn;
  }

  return join(projectDir, "playwright.config.ts");
}

export async function runTests(
  options: TestRunOptions,
): Promise<OrchestratorRunResult> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const { config, configPath } = await loadGoodGirlConfig(cwd, options.configPath);
  const projectDir = configPath ? dirname(configPath) : cwd;

  const resolvedConfig = {
    ...config,
    testDir: resolve(projectDir, config.testDir),
    resultsDir: resolve(projectDir, config.resultsDir),
  };

  const { resultsDir, jsonReportPath, htmlReportDir } = getResultsPaths(
    projectDir,
    config.resultsDir,
  );
  ensureDirectoryExists(resultsDir);

  const playwrightConfigPath = resolvePlaywrightConfigPath(projectDir);
  const cli = resolvePlaywrightCli();

  const pwArgs = [...cli.args, "test", `--config=${playwrightConfigPath}`];

  if (options.type === "e2e") {
    pwArgs.push("--project=e2e");
  } else if (options.type === "api") {
    pwArgs.push("--project=api");
  }

  if (options.headed) {
    pwArgs.push("--headed");
  }

  if (options.grep) {
    pwArgs.push(`--grep=${options.grep}`);
  }

  const env = {
    ...process.env,
    GOODGIRL_CONFIG_JSON: JSON.stringify(resolvedConfig),
    GOODGIRL_RESULTS_DIR: resultsDir,
    GOODGIRL_JSON_REPORT: jsonReportPath,
    GOODGIRL_HTML_REPORT: htmlReportDir,
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonReportPath,
  };

  const subprocess = await runSubprocess(cli.command, pwArgs, {
    cwd: projectDir,
    env,
  });

  const summary = parsePlaywrightJsonReport(jsonReportPath, htmlReportDir);

  return {
    summary,
    subprocess,
  };
}
