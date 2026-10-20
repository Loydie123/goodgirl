import pc from "picocolors";
import { runLoadDoctorChecks, runLoadTest } from "@goodgirl/core";
import { printLoadTerminalSummary } from "@goodgirl/reporter";
import type { LoadRunOptions } from "@goodgirl/shared";

export interface CliLoadRunOptions {
  vus?: string | number;
  duration?: string;
  iterations?: string | number;
  stage?: string[];
  env?: string[];
  summaryExport?: string;
  jsonReport?: string;
  allowExternal?: boolean;
  raw?: boolean;
  config?: string;
  passthroughArgs?: string[];
}

export async function executeLoadDoctorCommand(
  options: { config?: string } = {},
): Promise<number> {
  console.log("\n" + pc.cyan(pc.bold("🩺 Running GoodGirl k6 Performance Diagnostics...\n")));

  const report = await runLoadDoctorChecks(process.cwd(), options.config);

  for (const check of report.checks) {
    let icon = pc.green("✔");
    if (check.status === "warn") icon = pc.yellow("⚠");
    if (check.status === "fail") icon = pc.red("✖");

    console.log(`  ${icon} ${pc.bold(check.name)}: ${check.message}`);
    if (check.details) {
      const indented = check.details
        .split("\n")
        .map((l) => `    ${pc.dim(l)}`)
        .join("\n");
      console.log(indented);
    }
  }

  console.log("");
  if (report.healthy) {
    console.log(pc.green(pc.bold("✨ All k6 performance checks passed! Environment is ready.\n")));
    return 0;
  }

  console.log(pc.yellow(pc.bold("⚠ k6 is not fully configured. Review the recommendations above.\n")));
  return 1;
}

export async function executeLoadRunCommand(
  scriptPath: string,
  options: CliLoadRunOptions = {},
): Promise<number> {
  if (!scriptPath) {
    console.error(pc.red("\n✖ Error: A target k6 script must be specified."));
    console.log(pc.dim("Example: goodgirl load run examples/k6/smoke.js\n"));
    return 1;
  }

  // Parse env array "KEY=VAL" into record
  const envMap: Record<string, string> = {};
  if (options.env) {
    for (const e of options.env) {
      const eqIdx = e.indexOf("=");
      if (eqIdx !== -1) {
        envMap[e.slice(0, eqIdx)] = e.slice(eqIdx + 1);
      }
    }
  }

  const vus = options.vus !== undefined ? Number(options.vus) : undefined;
  const iterations = options.iterations !== undefined ? Number(options.iterations) : undefined;

  const loadOpts: LoadRunOptions = {
    script: scriptPath,
    vus: Number.isNaN(vus) ? undefined : vus,
    duration: options.duration,
    iterations: Number.isNaN(iterations) ? undefined : iterations,
    stages: options.stage,
    env: Object.keys(envMap).length > 0 ? envMap : undefined,
    summaryExport: options.summaryExport,
    jsonReportPath: options.jsonReport,
    allowExternal: options.allowExternal,
    raw: options.raw,
    configPath: options.config,
    passthroughArgs: options.passthroughArgs,
    cwd: process.cwd(),
  };

  try {
    const summary = await runLoadTest(loadOpts);
    printLoadTerminalSummary(summary);
    return summary.success ? 0 : (summary.exitCode || 1);
  } catch (err) {
    console.error(pc.red(`\n✖ Load Test Error: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}
