import { existsSync, readFileSync } from "node:fs";
import type { TestFailureDetail, TestSummary } from "@goodgirl/shared";
import type {
  PlaywrightJsonReport,
  PlaywrightSpec,
  PlaywrightSuite,
  PlaywrightTestError,
} from "./types.js";

function cleanErrorMessage(error: PlaywrightTestError): string {
  if (error.message) {
    // Strip ANSI escape codes and clean stack noise
    const cleaned = error.message.replace(
      // eslint-disable-next-line no-control-regex
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      "",
    );
    const lines = cleaned.split("\n").map((l) => l.trimEnd());
    return lines.slice(0, 5).join("\n");
  }
  return error.value ?? "Unknown error";
}

function collectSpecs(suite: PlaywrightSuite): PlaywrightSpec[] {
  const specs: PlaywrightSpec[] = [...(suite.specs ?? [])];
  if (suite.suites) {
    for (const subSuite of suite.suites) {
      specs.push(...collectSpecs(subSuite));
    }
  }
  return specs;
}

export function parsePlaywrightJsonReport(
  jsonReportPath: string,
  htmlReportDir?: string,
): TestSummary {
  if (!existsSync(jsonReportPath)) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      success: false,
      failures: [
        {
          title: "Report Resolution",
          error: `Playwright JSON report file not found at: ${jsonReportPath}`,
        },
      ],
      reportPath: htmlReportDir,
      resultsJsonPath: jsonReportPath,
    };
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(jsonReportPath, "utf-8");
  } catch (err) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      success: false,
      failures: [
        {
          title: "Report Read Failure",
          error: err instanceof Error ? err.message : String(err),
        },
      ],
      reportPath: htmlReportDir,
      resultsJsonPath: jsonReportPath,
    };
  }

  let report: PlaywrightJsonReport;
  try {
    report = JSON.parse(rawContent) as PlaywrightJsonReport;
  } catch (err) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      success: false,
      failures: [
        {
          title: "JSON Parse Failure",
          error: `Failed to parse Playwright report: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      reportPath: htmlReportDir,
      resultsJsonPath: jsonReportPath,
    };
  }

  const allSpecs: PlaywrightSpec[] = [];
  if (report.suites) {
    for (const topSuite of report.suites) {
      allSpecs.push(...collectSpecs(topSuite));
    }
  }

  const failures: TestFailureDetail[] = [];

  // Global errors
  if (report.errors && report.errors.length > 0) {
    for (const err of report.errors) {
      failures.push({
        title: "Global Execution Error",
        error: cleanErrorMessage(err),
      });
    }
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const spec of allSpecs) {
    const isOk = spec.ok;
    const test = spec.tests[0];
    const status = test?.status;

    if (status === "skipped") {
      skipped++;
    } else if (isOk) {
      passed++;
    } else {
      failed++;
      const lastResult = test?.results[test.results.length - 1];
      const errorMsg =
        lastResult?.errors && lastResult.errors.length > 0
          ? cleanErrorMessage(lastResult.errors[0]!)
          : "Test failed without explicit message";

      const loc = spec.file
        ? `${spec.file}${spec.line ? `:${spec.line}` : ""}`
        : undefined;

      failures.push({
        title: spec.title,
        location: loc,
        error: errorMsg,
      });
    }
  }

  const total = passed + failed + skipped;
  const durationMs = report.stats?.duration ?? 0;
  const success = failed === 0 && failures.length === 0 && total > 0;

  return {
    total,
    passed,
    failed,
    skipped,
    durationMs,
    success,
    failures,
    reportPath: htmlReportDir,
    resultsJsonPath: jsonReportPath,
  };
}
