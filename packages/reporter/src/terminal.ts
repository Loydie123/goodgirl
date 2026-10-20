import pc from "picocolors";
import type { TestSummary } from "@goodgirl/shared";

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

export function printTerminalSummary(summary: TestSummary): void {
  const line = pc.dim("─".repeat(56));
  console.log("\n" + line);
  console.log(` ${pc.bold("GoodGirl Test Execution Summary")}`);
  console.log(line);

  const statusLabel = summary.success
    ? pc.green(pc.bold("✔ PASSED"))
    : pc.red(pc.bold("✖ FAILED"));

  console.log(`  ${pc.bold("Overall Status:")}  ${statusLabel}`);
  console.log(`  ${pc.bold("Total Tests:")}     ${summary.total}`);
  console.log(`  ${pc.bold("Passed:")}          ${summary.passed > 0 ? pc.green(summary.passed) : summary.passed}`);
  if (summary.flaky > 0) {
    console.log(`  ${pc.bold("Flaky (Retried):")} ${pc.yellow(summary.flaky)}`);
  }
  console.log(`  ${pc.bold("Failed:")}          ${summary.failed > 0 ? pc.red(summary.failed) : summary.failed}`);
  console.log(`  ${pc.bold("Skipped:")}         ${summary.skipped > 0 ? pc.yellow(summary.skipped) : summary.skipped}`);
  console.log(`  ${pc.bold("Duration:")}        ${formatDuration(summary.durationMs)}`);

  if (summary.reportPath) {
    console.log(`  ${pc.bold("HTML Report:")}     ${pc.cyan(summary.reportPath)}`);
  }
  if (summary.resultsJsonPath) {
    console.log(`  ${pc.bold("JSON Report:")}     ${pc.cyan(summary.resultsJsonPath)}`);
  }

  if (summary.failures.length > 0) {
    console.log(line);
    console.log(` ${pc.red(pc.bold("Failure Details:"))}`);
    for (const fail of summary.failures) {
      const projTag = fail.project ? pc.cyan(`[${fail.project}] `) : "";
      console.log(`  ${pc.red("✖")} ${projTag}${pc.bold(fail.title)}${fail.location ? pc.dim(` (${fail.location})`) : ""}`);
      if (fail.error) {
        const indented = fail.error
          .split("\n")
          .map((l) => `      ${l}`)
          .join("\n");
        console.log(pc.dim(indented));
      }
    }
  }

  console.log(line + "\n");
}
