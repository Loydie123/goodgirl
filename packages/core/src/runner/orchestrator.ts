import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Socket } from "node:net";
import {
  ensureDirectoryExists,
  getResultsPaths,
  type LoadRunOptions,
  type LoadRunSummary,
  type SecurityRunOptions,
  type SecurityRunSummary,
  type TestRunOptions,
  type TestSummary,
} from "@goodgirl/shared";
import { parsePlaywrightJsonReport } from "@goodgirl/reporter";
import { createPlaywrightConfig, startFixtureServer, type FixtureServerInstance } from "@goodgirl/playwright";
import { runK6Test } from "@goodgirl/k6";
import { runZapAutomation } from "@goodgirl/zap";
import { loadGoodGirlConfig } from "../config/loader.js";
import { runSubprocess, type SubprocessResult } from "./subprocess.js";


export interface OrchestratorRunResult {
  summary: TestSummary;
  subprocess: SubprocessResult;
}

export function resolvePlaywrightCli(projectDir: string = process.cwd()): { command: string; args: string[] } {
  try {
    const projectRequire = createRequire(join(resolve(projectDir), "package.json"));
    let current = resolve(projectDir);
    let candidate: string | undefined;
    while (true) {
      const path = join(current, "node_modules", "@playwright", "test", "package.json");
      if (existsSync(path)) { candidate = path; break; }
      if (current === dirname(current)) break;
      current = dirname(current);
    }
    if (!candidate) throw new Error("No project-local Playwright dependency");
    const pkg = projectRequire.resolve(candidate);
    return { command: process.execPath, args: [join(dirname(pkg), "cli.js")] };
  } catch {
    throw new Error(`Playwright is not installed for "${projectDir}". Run pnpm add -D @playwright/test in that QA directory, then pnpm exec playwright install chromium firefox webkit.`);
  }
}

export function resolvePlaywrightConfigPath(projectDir: string): string | undefined {
  return ["ts", "js", "mjs", "mts", "cts", "cjs"].map(ext => join(projectDir, `playwright.config.${ext}`)).find(existsSync);
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

  // Browser/video overrides are applied to the config, including named projects.

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

  const nativeConfig = options.playwrightConfigPath ? resolve(projectDir, options.playwrightConfigPath) : resolvePlaywrightConfigPath(projectDir);
  if (nativeConfig && !existsSync(nativeConfig)) throw new Error(`Playwright config not found: ${nativeConfig}`);
  const cli = resolvePlaywrightCli(projectDir);
  // Keep native reporter and path semantics. Append our reporter instead of replacing theirs.
  const bridge = join(nativeConfig ? dirname(nativeConfig) : projectDir, `.goodgirl-${randomUUID()}.config.ts`);
  const builtIn = createPlaywrightConfig(projectDir, resolvedConfig);
  const overrides = { browserName: options.browser, video: options.video,
    ...(process.env.GOODGIRL_BASE_URL ? { baseURL: config.baseURL } : {}) };
  if (options.browser === "all" && nativeConfig) throw new Error("Use --project to select native browser projects, or omit --browser to run all configured projects.");
  if (options.browser === "all") {
    overrides.browserName = undefined;
    Object.assign(builtIn, createPlaywrightConfig(projectDir, { ...resolvedConfig, browsers: ["chromium", "firefox", "webkit"] }));
  }
  if (options.passthroughArgs?.some(arg => /^(--config(?:=|$)|-c$)/.test(arg))) {
    throw new Error("Use --playwright-config <path> to select a native config; GoodGirl must retain its current-run reporter.");
  }
  const script = `${nativeConfig ? `import original from ${JSON.stringify(nativeConfig.replace(/\\/g, "/"))};` : `const original = ${JSON.stringify(builtIn)};`}
const overrides = ${JSON.stringify(overrides)};
const config = { ...original, use: { ...original.use, ...overrides } };
if (config.projects) config.projects = config.projects.map(p => ({ ...p, use: { ...p.use, ...overrides } }));
const reporters = typeof config.reporter === 'string' ? [[config.reporter]] : (config.reporter || [['list']]);
if (!reporters.some(r => r[0] === 'html')) reporters.push(['html', { outputFolder: ${JSON.stringify(htmlReportDir)}, open: 'never' }]);
config.reporter = [...reporters, ['json', { outputFile: ${JSON.stringify(jsonReportPath)} }]];
export default config;
`;
  // --reporter is a native explicit override; add our JSON reporter via the config instead.
  const passthrough = [...(options.passthroughArgs ?? [])];
  let reporterOverride: string | undefined;
  for (let i = 0; i < passthrough.length; i++) {
    if (passthrough[i] === "--reporter") {
      if (!passthrough[i + 1]) throw new Error("--reporter requires a value.");
      reporterOverride = passthrough.splice(i, 2)[1]; i--;
    } else if (passthrough[i]?.startsWith("--reporter=")) { reporterOverride = passthrough.splice(i, 1)[0]!.slice(11); i--; }
  }
  writeFileSync(bridge, reporterOverride ? script.replace("const reporters =", `config.reporter = ${JSON.stringify(reporterOverride.split(",").map(r => [r]))};\nconst reporters =`) : script);
  if (existsSync(jsonReportPath)) unlinkSync(jsonReportPath);
  const pwArgs = buildPlaywrightArgs(cli.args, bridge, { ...options, passthroughArgs: passthrough });
  const env: NodeJS.ProcessEnv = { ...process.env, ...(options.debug ? { PWDEBUG: "1" } : {}) };
  let subprocess: SubprocessResult;
  try { subprocess = await runSubprocess(cli.command, pwArgs, { cwd: projectDir, env }); }
  finally { unlinkSync(bridge); }
  const summary = options.list ? { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0, success: subprocess.exitCode === 0, failures: [] }
    : parsePlaywrightJsonReport(jsonReportPath, htmlReportDir);

  return {
    summary,
    subprocess,
  };
}

export async function launchTraceViewer(
  tracePath?: string,
  cwd: string = process.cwd(),
): Promise<SubprocessResult> {
  const cli = resolvePlaywrightCli(cwd);
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
  const cli = resolvePlaywrightCli(options.cwd ?? process.cwd());
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
  const cli = resolvePlaywrightCli(cwd);
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
    options.script.includes("arrival-rate") ||
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
    return await runK6Test(options, {
      ...config.k6,
      resultsDir: config.k6?.resultsDir ?? config.resultsDir,
    });
  } finally {
    if (fixtureServer) {
      await fixtureServer.close().catch(() => {});
    }
  }
}

/**
 * Executes an OWASP ZAP security scan using GoodGirl configuration.
 * Automatically ensures local fixture server is available if targeting localhost.
 */
export async function runSecurityTest(
  options: SecurityRunOptions,
): Promise<SecurityRunSummary> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const { config } = await loadGoodGirlConfig(cwd, options.configPath);

  const mergedOptions: SecurityRunOptions = {
    ...options,
    cwd,
    allowExternal: options.allowExternal ?? config.security?.allowExternal ?? config.security?.allowExternalTargets ?? false,
    failOnRisk: options.failOnRisk ?? config.security?.failOnRisk,
    dockerImage: options.dockerImage ?? config.security?.dockerImage,
    zapPath: options.zapPath ?? config.security?.zapPath,
    timeoutSeconds: options.timeoutSeconds ?? config.security?.defaultTimeoutSeconds,
    reportDir: options.reportDir ?? config.security?.resultsDir ?? config.resultsDir,
  };

  let fixtureServer: FixtureServerInstance | undefined;
  const target = options.target ?? "http://127.0.0.1:4173";
  const isLocalTarget =
    target.includes("4173") ||
    target.includes("127.0.0.1") ||
    target.includes("localhost") ||
    (options.planPath ? options.planPath.includes("baseline") || options.planPath.includes("api") : false);

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
    return await runZapAutomation(mergedOptions);
  } finally {
    if (fixtureServer) {
      await fixtureServer.close().catch(() => {});
    }
  }
}


