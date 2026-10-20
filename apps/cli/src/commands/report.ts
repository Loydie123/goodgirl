import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { launchShowReport, loadGoodGirlConfig } from "@goodgirl/core";
import { getResultsPaths, toFileUrlString, type ReportFormat } from "@goodgirl/shared";

export interface CliReportOptions {
  format?: string;
  config?: string;
  open?: boolean;
}

export async function executeReportCommand(options: CliReportOptions = {}): Promise<number> {
  const format: ReportFormat =
    options.format === "json" || options.format === "JSON" ? "json" : "html";

  const cwd = process.cwd();
  const { config } = await loadGoodGirlConfig(cwd, options.config);
  const { jsonReportPath, htmlReportDir } = getResultsPaths(
    cwd,
    config.resultsDir,
  );

  if (format === "json") {
    if (!existsSync(jsonReportPath)) {
      console.error(
        pc.red(`\n✖ No JSON report found at "${jsonReportPath}". Run tests first with \`goodgirl test all\`.\n`),
      );
      return 1;
    }

    try {
      const raw = readFileSync(jsonReportPath, "utf-8");
      const parsed = JSON.parse(raw);
      console.log(JSON.stringify(parsed, null, 2));
      return 0;
    } catch (err) {
      console.error(pc.red(`\n✖ Failed to read JSON report: ${err instanceof Error ? err.message : String(err)}\n`));
      return 1;
    }
  }

  // HTML format
  const htmlIndex = join(htmlReportDir, "index.html");
  if (!existsSync(htmlIndex)) {
    console.error(
      pc.red(`\n✖ No HTML report found at "${htmlIndex}". Run tests first with \`goodgirl test all\`.\n`),
    );
    return 1;
  }

  if (options.open) {
    console.log(pc.cyan(`\n🌐 Opening Playwright HTML report from ${htmlReportDir}...\n`));
    try {
      const result = await launchShowReport(htmlReportDir, cwd);
      return result.exitCode;
    } catch (err) {
      console.error(pc.red(`\n✖ Failed to open HTML report: ${err instanceof Error ? err.message : String(err)}\n`));
      return 1;
    }
  }

  const fileUrl = toFileUrlString(htmlIndex);
  console.log("\n" + pc.dim("─".repeat(56)));
  console.log(` ${pc.bold("GoodGirl HTML Test Report")}`);
  console.log(pc.dim("─".repeat(56)));
  console.log(`  ${pc.bold("Location:")} ${pc.cyan(htmlIndex)}`);
  console.log(`  ${pc.bold("Open in Browser:")} ${pc.green(fileUrl)}`);
  console.log(
    pc.dim(`\n  Tip: Run with \`--open\` or use \`playwright show-report\` to launch local report viewer.`),
  );
  console.log(pc.dim("─".repeat(56)) + "\n");

  return 0;
}

