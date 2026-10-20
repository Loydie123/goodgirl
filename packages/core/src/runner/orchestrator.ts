import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { Socket } from "node:net";
import {
  ensureDirectoryExists,
  getResultsPaths,
  type LoadRunOptions,
  type LoadRunSummary,
  type TestRunOptions,
  type TestSummary,
} from "@goodgirl/shared";
import { parsePlaywrightJsonReport } from "@goodgirl/reporter";
import { startFixtureServer, type FixtureServerInstance } from "@goodgirl/playwright";
import { runK6Test } from "@goodgirl/k6";
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
  for (const candidate of localCandidates) {
    if (existsSync(candidate)) {
      return candidate;
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

  // Search parent directories for packages/playwright/playwright.config.ts (monorepo support)
  let curr = projectDir;
  while (curr !== dirname(curr)) {
    const candidate = join(curr, "packages", "playwright", "playwright.config.ts");
    if (existsSync(candidate)) {
      return candidate;
    }
    curr = dirname(curr);
  }

  return join(projectDir, "playwright.config.ts");
}

export function buildPlaywrightArgs(
  cliArgs: string[],
  playwrightConfigPath: string,
  options: TestRunOptions,
): string[] {
  const pwArgs = [...cliArgs, "test", `--config=${playwrightConfigPath}`];

  // Specific project selection or routing
  if (options.project) {
    pwArgs.push(`--project=${options.project}`);
  } else if (options.projects && options.projects.length > 0) {
    for (const p of options.projects) {
      pwArgs.push(`--project=${p}`);
    }
  } else if (options.type === "e2e") {
    pwArgs.push("--project=e2e");
  } else if (options.type === "api") {
    pwArgs.push("--project=api");
  }

  // Browser type flag
  if (options.browser) {
    pwArgs.push(`--browser=${options.browser}`);
  }

  // Headed execution
  if (options.headed) {
    pwArgs.push("--headed");
  }

  // Grep pattern filters
  if (options.grep) {
    pwArgs.push(`--grep=${options.grep}`);
  }
  if (options.grepInvert) {
    pwArgs.push(`--grep-invert=${options.grepInvert}`);
  }

  // Concurrency & Workers
  if (options.workers !== undefined) {
    pwArgs.push(`--workers=${options.workers}`);
  }

  // Retries & Timeout
  if (options.retries !== undefined) {
    pwArgs.push(`--retries=${options.retries}`);
  }
  if (options.timeout !== undefined) {
    pwArgs.push(`--timeout=${options.timeout}`);
  }

  // Sharding & Repetition
  if (options.shard) {
    pwArgs.push(`--shard=${options.shard}`);
  }
  if (options.repeatEach !== undefined) {
    pwArgs.push(`--repeat-each=${options.repeatEach}`);
  }

  // Fail-fast
  if (options.maxFailures !== undefined) {
    pwArgs.push(`--max-failures=${options.maxFailures}`);
  }

  // Re-run failures & List mode
  if (options.lastFailed) {
    pwArgs.push("--last-failed");
  }
  if (options.list) {
    pwArgs.push("--list");
  }

  // Debugging & Inspector
  if (options.debug) {
    pwArgs.push("--debug");
  }
  if (options.ui) {
    pwArgs.push("--ui");
  }

  // Tracing override
  if (options.trace) {
    pwArgs.push(`--trace=${options.trace}`);
  }

  // Specific file/directory targets
  if (options.files && options.files.length > 0) {
    pwArgs.push(...options.files);
  }

  // Raw passthrough arguments (passed after --)
  if (options.passthroughArgs && options.passthroughArgs.length > 0) {
    pwArgs.push(...options.passthroughArgs);
  }

  return pwArgs;
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

  const pwArgs = buildPlaywrightArgs(cli.args, playwrightConfigPath, options);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GOODGIRL_CONFIG_JSON: JSON.stringify(resolvedConfig),
    GOODGIRL_RESULTS_DIR: resultsDir,
    GOODGIRL_JSON_REPORT: jsonReportPath,
    GOODGIRL_HTML_REPORT: htmlReportDir,
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonReportPath,
  };

  if (options.debug) {
    env.PWDEBUG = "1";
  }
  if (options.headed) {
    env.GOODGIRL_HEADED = "1";
  }

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

export async function launchTraceViewer(
  tracePath?: string,
  cwd: string = process.cwd(),
): Promise<SubprocessResult> {
  const cli = resolvePlaywrightCli();
  const args = [...cli.args, "show-trace"];
  if (tracePath) {
    args.push(tracePath);
  }
  return runSubprocess(cli.command, args, { cwd });
}

export interface CodegenOptions {
  browser?: string;
  device?: string;
  output?: string;
  cwd?: string;
}

export async function launchCodegen(
  url?: string,
  options: CodegenOptions = {},
): Promise<SubprocessResult> {
  const cli = resolvePlaywrightCli();
  const args = [...cli.args, "codegen"];
  if (options.browser) {
    args.push(`--browser=${options.browser}`);
  }
  if (options.device) {
    args.push(`--device=${options.device}`);
  }
  if (options.output) {
    args.push(`--output=${options.output}`);
  }
  if (url) {
    args.push(url);
  }
  return runSubprocess(cli.command, args, { cwd: options.cwd ?? process.cwd() });
}

export async function launchShowReport(
  reportDir?: string,
  cwd: string = process.cwd(),
): Promise<SubprocessResult> {
  const cli = resolvePlaywrightCli();
  const args = [...cli.args, "show-report"];
  if (reportDir) {
    args.push(reportDir);
  }
  return runSubprocess(cli.command, args, { cwd });
}

function isPortListening(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((res) => {
    const socket = new Socket();
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      res(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      res(false);
    });
    socket.once("error", () => {
      socket.destroy();
      res(false);
    });
    socket.connect(port, host);
  });
}

/**
 * Executes a native Grafana k6 load test using GoodGirl configuration.
 * Automatically ensures local fixture server is available if targeting localhost.
 */
export async function runLoadTest(
  options: LoadRunOptions,
): Promise<LoadRunSummary> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const { config } = await loadGoodGirlConfig(cwd, options.configPath);

  let fixtureServer: FixtureServerInstance | undefined;
  const isLocalTarget =
    (config.baseURL ?? "").includes("4173") ||
    options.script.includes("smoke") ||
    options.script.includes("load") ||
    options.script.includes("stress") ||
    options.script.includes("spike") ||
    options.script.includes("soak") ||
    options.script.includes("custom-metrics");

  if (isLocalTarget) {
    const isListening = await isPortListening(4173);
    if (!isListening) {
      try {
        fixtureServer = await startFixtureServer(4173);
      } catch {
        // Continue if port is in use or cannot be bound
      }
    }
  }

  try {
    return await runK6Test(options, config.k6);
  } finally {
    if (fixtureServer) {
      await fixtureServer.close().catch(() => {});
    }
  }
}


