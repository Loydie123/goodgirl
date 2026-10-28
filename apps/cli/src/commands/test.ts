import pc from "picocolors";
import { runTests } from "@goodgirl/core";
import { printTerminalSummary } from "@goodgirl/reporter";
import type {
  BrowserType,
  TestRunOptions,
  TestType,
  TraceOption,
  VideoOption,
} from "@goodgirl/shared";

export interface CliTestOptions {
  files?: string[];
  browser?: string;
  project?: string;
  headed?: boolean;
  workers?: string | number;
  retries?: string | number;
  timeout?: string | number;
  grep?: string;
  grepInvert?: string;
  shard?: string;
  repeatEach?: string | number;
  maxFailures?: string | number;
  lastFailed?: boolean;
  list?: boolean;
  debug?: boolean;
  ui?: boolean;
  trace?: string;
  video?: string;
  config?: string;
  playwrightConfig?: string;
  passthroughArgs?: string[];
}

export async function executeTestCommand(
  type: TestType,
  filesOrOptions: string[] | CliTestOptions = [],
  maybeOptions: CliTestOptions = {},
): Promise<number> {
  const files: string[] = Array.isArray(filesOrOptions) ? filesOrOptions : [];
  const options: CliTestOptions = Array.isArray(filesOrOptions) ? maybeOptions : filesOrOptions;

  const details: string[] = [];
  if (options.browser) details.push(`browser: ${options.browser}`);
  if (options.project) details.push(`project: ${options.project}`);
  if (options.headed) details.push("headed mode");
  if (options.workers) details.push(`workers: ${options.workers}`);
  if (options.grep) details.push(`grep: "${options.grep}"`);
  if (options.debug) details.push("debug inspector");
  if (options.ui) details.push("UI mode");
  if (files.length > 0) details.push(`targets: ${files.join(", ")}`);

  const detailsStr = details.length > 0 ? ` (${details.join(", ")})` : "";
  console.log(pc.cyan(`\n🚀 Starting GoodGirl ${type.toUpperCase()} test suite${detailsStr}...\n`));

  // Parse numeric flags safely
  const parseNum = (val: string | number | undefined): number | undefined => {
    if (val === undefined) return undefined;
    if (typeof val === "number") return val;
    const parsed = Number.parseInt(val, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const runOptions: TestRunOptions = {
    type,
    files: files.length > 0 ? files : undefined,
    browser: options.browser as BrowserType | undefined,
    project: options.project,
    headed: options.headed,
    grep: options.grep,
    grepInvert: options.grepInvert,
    workers: typeof options.workers === "string" && options.workers.includes("%")
      ? options.workers
      : parseNum(options.workers),
    retries: parseNum(options.retries),
    timeout: parseNum(options.timeout),
    shard: options.shard,
    repeatEach: parseNum(options.repeatEach),
    maxFailures: parseNum(options.maxFailures),
    lastFailed: options.lastFailed,
    list: options.list,
    debug: options.debug,
    ui: options.ui,
    trace: options.trace as TraceOption | undefined,
    video: options.video as VideoOption | undefined,
    passthroughArgs: options.passthroughArgs,
    configPath: options.config,
    playwrightConfigPath: options.playwrightConfig,
    cwd: process.cwd(),
  };

  try {
    const { summary, subprocess } = await runTests(runOptions);

    // Print normalized terminal summary (unless in list mode)
    if (!options.list) {
      printTerminalSummary(summary);
    }

    if (!summary.success || subprocess.exitCode !== 0) {
      return subprocess.exitCode !== 0 ? subprocess.exitCode : 1;
    }
    return 0;
  } catch (err) {
    console.error(pc.red(`\n✖ Test execution error: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}

