import pc from "picocolors";
import type { SecurityRunSummary, ZapRiskLevel } from "@goodgirl/shared";

function formatMs(ms?: number): string {
  if (ms === undefined || Number.isNaN(ms)) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Redacts potential credentials, authorization tokens, and API keys from text.
 *
 * NOTE: Regex-based redaction provides best-effort defense-in-depth to mask
 * common authorization tokens in terminal output. It does not provide an
 * absolute cryptographic sanitization guarantee for arbitrary payloads.
 */
export function redactSensitiveData(text: string): string {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1***REDACTED***")
    .replace(/(Basic\s+)[A-Za-z0-9+/]+=*/gi, "$1***REDACTED***")
    .replace(/((?:password|passwd|token|apiKey|api_key|secret|auth)\s*[:=]\s*['"]?)[^'"\s&,]+/gi, "$1***REDACTED***");
}

function getRiskBadge(risk: ZapRiskLevel): string {
  switch (risk) {
    case "High":
      return pc.bgRed(pc.white(pc.bold(" HIGH ")));
    case "Medium":
      return pc.bgYellow(pc.black(pc.bold(" MEDIUM ")));
    case "Low":
      return pc.bgCyan(pc.black(pc.bold(" LOW ")));
    case "Informational":
    default:
      return pc.bgBlue(pc.white(pc.bold(" INFO ")));
  }
}

/**
 * Formats a structured ANSI security summary card string for CLI output.
 */
export function formatSecurityTerminalSummary(summary: SecurityRunSummary): string {
  const line = pc.dim("─".repeat(60));
  const lines: string[] = [];

  lines.push(line);
  lines.push(` ${pc.bold("GoodGirl Security Test Summary (OWASP ZAP)")}`);
  lines.push(line);

  const statusLabel = summary.success
    ? pc.green(pc.bold("✔ PASSED"))
    : pc.red(pc.bold("✖ FAILED"));

  const thresholdLabel = summary.thresholdPassed
    ? pc.green("✔ Satisfied")
    : summary.riskSummary.total > 0
      ? pc.red("✖ Threshold Breached")
      : pc.red("✖ Incomplete / No Report");

  const targetLabel = summary.target || summary.planPath || "ZAP Automation Plan";
  lines.push(`  ${pc.bold("Target / Plan:")}     ${pc.cyan(redactSensitiveData(targetLabel))}`);
  lines.push(
    `  ${pc.bold("Execution Engine:")}  ${summary.engine.type === "docker" ? "Docker (" + (summary.engine.image ?? "zap") + ")" : "Local ZAP"}` +
    (summary.engine.version ? ` [${summary.engine.version}]` : ""),
  );
  lines.push(`  ${pc.bold("Overall Status:")}    ${statusLabel}`);
  lines.push(`  ${pc.bold("Risk Threshold:")}    ${thresholdLabel}`);
  if (summary.failureReason) {
    lines.push(`  ${pc.bold("Failure Reason:")}    ${pc.red(summary.failureReason)}`);
  }
  lines.push(`  ${pc.bold("Scan Duration:")}     ${formatMs(summary.durationMs)}`);

  // Risk Breakdown
  lines.push(line);
  lines.push(` ${pc.bold("Risk Summary:")}`);
  const r = summary.riskSummary;
  lines.push(`    ${pc.red(pc.bold("● HIGH:"))}           ${r.high > 0 ? pc.red(pc.bold(String(r.high))) : pc.dim("0")}`);
  lines.push(`    ${pc.yellow(pc.bold("● MEDIUM:"))}         ${r.medium > 0 ? pc.yellow(pc.bold(String(r.medium))) : pc.dim("0")}`);
  lines.push(`    ${pc.cyan(pc.bold("● LOW:"))}            ${r.low > 0 ? pc.cyan(String(r.low)) : pc.dim("0")}`);
  lines.push(`    ${pc.blue(pc.bold("● INFORMATIONAL:"))}  ${r.informational > 0 ? pc.blue(String(r.informational)) : pc.dim("0")}`);
  lines.push(`    ${pc.bold("Total Findings:")}    ${r.total}`);

  // Findings list (High and Medium alerts prioritized, plus Low if under 10 items)
  if (summary.alerts.length > 0) {
    lines.push(line);
    lines.push(` ${pc.bold("Security Findings:")}`);

    const displayAlerts = summary.alerts.slice(0, 10);
    for (const alert of displayAlerts) {
      const badge = getRiskBadge(alert.risk);
      const cwe = alert.cweId ? pc.dim(` [CWE-${alert.cweId}]`) : "";
      lines.push(`    ${badge} ${pc.bold(alert.name)}${cwe}`);
      lines.push(`      ${pc.dim("Occurrences:")} ${alert.count}`);
      if (alert.instances.length > 0) {
        const firstUri = alert.instances[0]?.uri;
        if (firstUri) {
          lines.push(`      ${pc.dim("Endpoint:")}    ${pc.dim(redactSensitiveData(firstUri))}`);
        }
      }
    }

    if (summary.alerts.length > 10) {
      lines.push(pc.dim(`    ... and ${summary.alerts.length - 10} more findings. See HTML/JSON report.`));
    }
  }

  // Reports
  lines.push(line);
  if (summary.reportPathHtml) {
    lines.push(`  ${pc.bold("HTML Report:")}       ${pc.cyan(summary.reportPathHtml)}`);
  }
  if (summary.reportPathJson) {
    lines.push(`  ${pc.bold("JSON Report:")}       ${pc.cyan(summary.reportPathJson)}`);
  }
  lines.push(line);

  return lines.join("\n");
}

/**
 * Prints the formatted security summary card directly to stdout.
 */
export function printSecurityTerminalSummary(summary: SecurityRunSummary): void {
  console.log("\n" + formatSecurityTerminalSummary(summary));
}
