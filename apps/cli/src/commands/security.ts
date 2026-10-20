import { existsSync, readFileSync } from "node:fs";
import pc from "picocolors";
import {
  loadGoodGirlConfig,
  runSecurityDoctorChecks,
  runSecurityTest,
  runSubprocess,
} from "@goodgirl/core";
import { printSecurityTerminalSummary } from "@goodgirl/reporter";
import {
  getSecurityResultsPaths,
  toFileUrlString,
  type ZapRiskLevel,
  type SecurityRunOptions,
} from "@goodgirl/shared";

export interface CliSecurityOptions {
  target?: string;
  spiderDuration?: string | number;
  spec?: string;
  failOn?: ZapRiskLevel;
  allowExternal?: boolean;
  authorized?: boolean;
  active?: boolean;
  allowActive?: boolean;
  raw?: boolean;
  config?: string;
  jsonReport?: string;
  htmlReport?: string;
  dockerImage?: string;
  zapPath?: string;
}

export async function executeSecurityDoctorCommand(
  options: { config?: string } = {},
): Promise<number> {
  console.log("\n" + pc.cyan(pc.bold("🩺 Running GoodGirl OWASP ZAP Security Diagnostics...\n")));

  const report = await runSecurityDoctorChecks(process.cwd(), options.config);

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
    console.log(pc.green(pc.bold("✨ All security checks passed! OWASP ZAP environment is ready.\n")));
    return 0;
  }

  console.log(pc.yellow(pc.bold("⚠ OWASP ZAP is not fully ready. Review the recommendations above.\n")));
  return 1;
}

export async function executeSecurityBaselineCommand(
  target?: string,
  options: CliSecurityOptions = {},
): Promise<number> {
  const targetUrl = target || options.target || "http://127.0.0.1:4173";

  const runOpts: SecurityRunOptions = {
    mode: "baseline",
    target: targetUrl,
    failOnRisk: options.failOn,
    allowExternal: options.allowExternal || options.authorized,
    raw: options.raw,
    configPath: options.config,
    dockerImage: options.dockerImage,
    zapPath: options.zapPath,
    cwd: process.cwd(),
  };

  try {
    const summary = await runSecurityTest(runOpts);
    printSecurityTerminalSummary(summary);
    return summary.success ? 0 : 1;
  } catch (err) {
    console.error(pc.red(`\n✖ Security Test Error: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}

export async function executeSecurityApiCommand(
  spec?: string,
  options: CliSecurityOptions = {},
): Promise<number> {
  const openApiSpec = spec || options.spec;
  if (!openApiSpec) {
    console.error(pc.red("\n✖ Error: An OpenAPI specification file or URL must be specified."));
    console.log(pc.dim("Example: goodgirl security api examples/zap/openapi.json --target http://127.0.0.1:4173\n"));
    return 1;
  }

  const runOpts: SecurityRunOptions = {
    mode: "api",
    apiSpec: openApiSpec,
    target: options.target,
    failOnRisk: options.failOn,
    allowExternal: options.allowExternal || options.authorized,
    raw: options.raw,
    configPath: options.config,
    dockerImage: options.dockerImage,
    zapPath: options.zapPath,
    cwd: process.cwd(),
  };

  try {
    const summary = await runSecurityTest(runOpts);
    printSecurityTerminalSummary(summary);
    return summary.success ? 0 : 1;
  } catch (err) {
    console.error(pc.red(`\n✖ Security Test Error: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}

export async function executeSecurityRunCommand(
  planPath: string,
  options: CliSecurityOptions = {},
): Promise<number> {
  if (!planPath) {
    console.error(pc.red("\n✖ Error: A ZAP Automation Framework plan (.yaml) must be specified."));
    console.log(pc.dim("Example: goodgirl security run examples/zap/baseline.yaml\n"));
    return 1;
  }

  const runOpts: SecurityRunOptions = {
    mode: "plan",
    planPath,
    target: options.target,
    activeScan: options.active || options.allowActive,
    failOnRisk: options.failOn,
    allowExternal: options.allowExternal || options.authorized,
    raw: options.raw,
    configPath: options.config,
    dockerImage: options.dockerImage,
    zapPath: options.zapPath,
    cwd: process.cwd(),
  };

  try {
    const summary = await runSecurityTest(runOpts);
    printSecurityTerminalSummary(summary);
    return summary.success ? 0 : 1;
  } catch (err) {
    console.error(pc.red(`\n✖ Security Test Error: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}

export async function executeSecurityReportCommand(
  options: { format?: string; open?: boolean; config?: string } = {},
): Promise<number> {
  const cwd = process.cwd();
  const { config } = await loadGoodGirlConfig(cwd, options.config);
  const { securityResultsJsonPath, securityHtmlReportPath } = getSecurityResultsPaths(
    cwd,
    config.resultsDir,
  );

  const format = options.format === "json" ? "json" : "html";

  if (format === "json") {
    if (!existsSync(securityResultsJsonPath)) {
      console.error(
        pc.red(`\n✖ No security JSON report found at "${securityResultsJsonPath}". Run security tests first.\n`),
      );
      return 1;
    }

    try {
      const raw = readFileSync(securityResultsJsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      console.log(JSON.stringify(parsed, null, 2));
      return 0;
    } catch (err) {
      console.error(pc.red(`\n✖ Failed to read security JSON report: ${err instanceof Error ? err.message : String(err)}\n`));
      return 1;
    }
  }

  // HTML format
  if (!existsSync(securityHtmlReportPath)) {
    console.error(
      pc.red(`\n✖ No security HTML report found at "${securityHtmlReportPath}". Run security tests first.\n`),
    );
    return 1;
  }

  if (options.open) {
    console.log(pc.cyan(`\n🌐 Opening ZAP Security HTML report from ${securityHtmlReportPath}...\n`));
    try {
      if (process.platform === "win32") {
        await runSubprocess("cmd.exe", ["/c", "start", "", securityHtmlReportPath], { cwd });
      } else if (process.platform === "darwin") {
        await runSubprocess("open", [securityHtmlReportPath], { cwd });
      } else {
        await runSubprocess("xdg-open", [securityHtmlReportPath], { cwd });
      }
      return 0;
    } catch (err) {
      console.error(pc.red(`\n✖ Failed to open HTML report: ${err instanceof Error ? err.message : String(err)}\n`));
      return 1;
    }
  }

  const fileUrl = toFileUrlString(securityHtmlReportPath);
  console.log("\n" + pc.dim("─".repeat(56)));
  console.log(` ${pc.bold("GoodGirl OWASP ZAP Security HTML Report")}`);
  console.log(pc.dim("─".repeat(56)));
  console.log(`  ${pc.bold("Location:")} ${pc.cyan(securityHtmlReportPath)}`);
  console.log(`  ${pc.bold("Open in Browser:")} ${pc.green(fileUrl)}`);
  console.log(
    pc.dim(`\n  Tip: Run with \`--open\` to launch automatically in your default browser.`),
  );
  console.log(pc.dim("─".repeat(56)) + "\n");

  return 0;
}
