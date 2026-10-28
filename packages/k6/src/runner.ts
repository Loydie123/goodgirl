import spawn from "cross-spawn";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  DEFAULT_K6_SUMMARY_TREND_STATS,
  ensureDirectoryExists,
  getK6ResultsPaths,
  type K6Config,
  type LoadRunOptions,
  type LoadRunSummary,
} from "@goodgirl/shared";
import { detectK6Sync, getK6InstallInstructions } from "./detector.js";
import { parseK6SummaryJson } from "./parser.js";
import { validateScriptTargetSafety } from "./safety.js";

export interface K6ExecutionResult {
  summary: LoadRunSummary;
  rawStdout?: string;
  rawStderr?: string;
}

/**
 * Builds the array of command-line arguments to pass to the official k6 executable.
 */
export function buildK6RunArgs(
  scriptPath: string,
  summaryExportPath: string,
  options: LoadRunOptions,
  config?: K6Config,
): string[] {
  const trendStats =
    options.summaryTrendStats ??
    (config?.summaryTrendStats ? config.summaryTrendStats.join(",") : DEFAULT_K6_SUMMARY_TREND_STATS);

  const args: string[] = [
    "run",
    `--summary-export=${summaryExportPath}`,
    `--summary-trend-stats=${trendStats}`,
  ];

  // Virtual users override
  if (options.vus !== undefined) {
    args.push(`--vus=${options.vus}`);
  } else if (config?.defaultVUs !== undefined) {
    args.push(`--vus=${config.defaultVUs}`);
  }

  // Duration override
  if (options.duration !== undefined) {
    args.push(`--duration=${options.duration}`);
  } else if (config?.defaultDuration !== undefined) {
    args.push(`--duration=${config.defaultDuration}`);
  }

  // Iterations override
  if (options.iterations !== undefined) {
    args.push(`--iterations=${options.iterations}`);
  }

  // Stages override
  if (options.stages && options.stages.length > 0) {
    for (const stage of options.stages) {
      args.push(`--stage=${stage}`);
    }
  }

  // Environment variables
  if (options.env) {
    for (const [k, v] of Object.entries(options.env)) {
      args.push(`--env=${k}=${v}`);
    }
  }

  // Raw passthrough arguments
  if (options.passthroughArgs && options.passthroughArgs.length > 0) {
    args.push(...options.passthroughArgs);
  }

  // Target script path
  args.push(scriptPath);

  return args;
}

/**
 * Executes a native k6 performance test script and returns a structured LoadRunSummary.
 */
export async function runK6Test(
  options: LoadRunOptions,
  config?: K6Config,
): Promise<LoadRunSummary> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const scriptPath = resolve(cwd, options.script);

  if (!existsSync(scriptPath)) {
    throw new Error(`Target k6 script not found: "${scriptPath}"`);
  }

  // Check k6 binary availability
  const detection = detectK6Sync(config?.binaryPath);
  if (!detection.available) {
    const install = getK6InstallInstructions();
    throw new Error(
      `Grafana k6 binary not found. Please install k6 before running load tests.\n` +
      `Recommended install command: "${install.recommendedCommand}"\n` +
      `Documentation: ${install.docsUrl}`,
    );
  }

  // Enforce safe target authorization
  const safety = validateScriptTargetSafety(scriptPath, {
    allowedTargets: config?.allowedTargets,
    allowExternal: options.allowExternal || config?.allowExternalTargets || config?.allowExternal,
    env: options.env,
  });

  if (!safety.safe) {
    throw new Error(safety.reason ?? "Target authorization check failed");
  }

  const { resultsDir, k6JsonReportPath } = getK6ResultsPaths(cwd, config?.resultsDir);
  ensureDirectoryExists(resultsDir);

  const summaryExportPath = options.summaryExport
    ? resolve(cwd, options.summaryExport)
    : k6JsonReportPath;

  ensureDirectoryExists(dirname(summaryExportPath));
  if (existsSync(summaryExportPath)) {
    try {
      unlinkSync(summaryExportPath);
    } catch {
      // Ignore unlink errors
    }
  }

  const k6Args = buildK6RunArgs(scriptPath, summaryExportPath, options, config);

  const startTime = Date.now();

  const exitCode = await new Promise<number>((res) => {
    const child = spawn(detection.command, k6Args, {
      cwd,
      stdio: options.raw ? "inherit" : ["inherit", "inherit", "inherit"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
    });

    const onSignal = (sig: NodeJS.Signals) => {
      try {
        if (!child.killed) {
          child.kill(sig);
        }
      } catch {
        // Ignore kill errors
      }
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    child.on("error", () => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      res(1);
    });

    child.on("close", (code) => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      res(code ?? 0);
    });
  });

  const durationMs = Date.now() - startTime;

  const summary = parseK6SummaryJson(
    summaryExportPath,
    options.script,
    durationMs,
    exitCode,
  );

  // If a distinct json report path was requested, persist it there as well
  if (options.jsonReportPath) {
    const outPath = resolve(cwd, options.jsonReportPath);
    ensureDirectoryExists(dirname(outPath));
    writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf-8");
    summary.resultsJsonPath = outPath;
  }

  return summary;
}
