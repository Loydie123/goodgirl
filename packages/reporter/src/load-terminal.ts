import pc from "picocolors";
import type { LoadRunSummary } from "@goodgirl/shared";

function formatMs(ms?: number): string {
  if (ms === undefined || Number.isNaN(ms)) return "N/A";
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || Number.isNaN(bytes)) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function printLoadTerminalSummary(summary: LoadRunSummary): void {
  const line = pc.dim("─".repeat(60));
  console.log("\n" + line);
  console.log(` ${pc.bold("GoodGirl Load Test Summary (Grafana k6)")}`);
  console.log(line);

  const statusLabel = summary.success
    ? pc.green(pc.bold("✔ PASSED"))
    : pc.red(pc.bold("✖ FAILED"));

  const thresholdLabel = summary.thresholdsPassed
    ? pc.green("✔ Satisfied")
    : pc.red("✖ Violated");

  console.log(`  ${pc.bold("Target Script:")}     ${pc.cyan(summary.script)}`);
  console.log(`  ${pc.bold("Overall Status:")}    ${statusLabel}`);
  if (summary.thresholds.length > 0) {
    console.log(`  ${pc.bold("Thresholds:")}        ${thresholdLabel}`);
  }
  console.log(`  ${pc.bold("Duration:")}          ${formatMs(summary.durationMs)}`);
  if (summary.vus) {
    console.log(`  ${pc.bold("Virtual Users:")}     max=${summary.vus.max}, current=${summary.vus.value}`);
  }

  // HTTP Latencies
  if (summary.httpReqDuration) {
    console.log(line);
    console.log(` ${pc.bold("HTTP Latency (http_req_duration):")}`);
    const d = summary.httpReqDuration;
    console.log(
      `    ${pc.dim("avg:")} ${formatMs(d.avg)}  ` +
      `${pc.dim("med:")} ${formatMs(d.med)}  ` +
      `${pc.dim("min:")} ${formatMs(d.min)}  ` +
      `${pc.dim("max:")} ${formatMs(d.max)}`,
    );
    console.log(
      `    ${pc.dim("p(90):")} ${formatMs(d.p90)}  ` +
      `${pc.dim("p(95):")} ${formatMs(d.p95)}  ` +
      (d.p99 !== undefined ? `${pc.dim("p(99):")} ${formatMs(d.p99)}` : ""),
    );
  }

  // Throughput and Requests
  if (summary.httpReqs || summary.httpReqFailed) {
    console.log(line);
    console.log(` ${pc.bold("Throughput & Requests:")}`);
    if (summary.httpReqs) {
      const rateStr = `${summary.httpReqs.rate.toFixed(1)} req/s`;
      console.log(`    ${pc.dim("Total Requests:")}  ${summary.httpReqs.count} (${pc.cyan(rateStr)})`);
    }
    if (summary.httpReqFailed) {
      const failRatePct = (summary.httpReqFailed.rate * 100).toFixed(2);
      const failedCount = summary.httpReqFailed.passes;
      const failColor = failedCount > 0 ? pc.red : pc.green;
      console.log(
        `    ${pc.dim("Failed Requests:")} ${failColor(`${failedCount} (${failRatePct}%)`)}`,
      );
    }
    if (summary.dataReceived) {
      console.log(
        `    ${pc.dim("Data Received:")}   ${formatBytes(summary.dataReceived.count)} (${formatBytes(summary.dataReceived.rate)}/s)`,
      );
    }
  }

  // Thresholds Table
  if (summary.thresholds.length > 0) {
    console.log(line);
    console.log(` ${pc.bold("Threshold Results:")}`);
    for (const t of summary.thresholds) {
      const mark = t.passed ? pc.green("✔") : pc.red("✖");
      const statusText = t.passed ? pc.green("PASSED") : pc.red("FAILED");
      console.log(`    ${mark} ${pc.bold(t.metric)}: ${pc.dim(t.expression)} [${statusText}]`);
    }
  }

  // Checks Table
  if (summary.checks.length > 0) {
    console.log(line);
    console.log(` ${pc.bold("Validation Checks:")}`);
    for (const c of summary.checks) {
      const mark = c.fails === 0 ? pc.green("✔") : pc.red("✖");
      const pct = `${c.successRate.toFixed(1)}%`;
      const counts = `${c.passes}/${c.passes + c.fails}`;
      console.log(`    ${mark} ${c.name} - ${pc.bold(pct)} (${counts})`);
    }
  }

  // Custom Metrics
  const customEntries = Object.entries(summary.metrics).filter(
    ([name]) =>
      !name.startsWith("http_req") &&
      !name.startsWith("iteration") &&
      !name.startsWith("data_") &&
      !name.startsWith("vus"),
  );

  if (customEntries.length > 0) {
    console.log(line);
    console.log(` ${pc.bold("Custom Metrics:")}`);
    for (const [name, m] of customEntries) {
      if (m.type === "trend") {
        console.log(`    ${pc.cyan(name)}: avg=${formatMs(m.avg)}, p(95)=${formatMs(m.p95)}`);
      } else if (m.type === "counter") {
        console.log(`    ${pc.cyan(name)}: count=${m.count}, rate=${m.rate?.toFixed(1)}/s`);
      } else if (m.type === "rate") {
        const pct = m.passes !== undefined && m.fails !== undefined
          ? `${(((m.passes) / (m.passes + m.fails || 1)) * 100).toFixed(1)}%`
          : `${((m.value ?? 0) * 100).toFixed(1)}%`;
        console.log(`    ${pc.cyan(name)}: rate=${pct}`);
      } else if (m.type === "gauge") {
        console.log(`    ${pc.cyan(name)}: value=${m.value}`);
      }
    }
  }

  if (summary.resultsJsonPath) {
    console.log(line);
    console.log(`  ${pc.bold("JSON Report:")}       ${pc.cyan(summary.resultsJsonPath)}`);
  }

  console.log(line + "\n");
}
