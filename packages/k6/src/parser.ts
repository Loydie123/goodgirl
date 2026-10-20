import { existsSync, readFileSync } from "node:fs";
import type {
  LoadCheckResult,
  LoadHttpLatencySummary,
  LoadMetricValue,
  LoadRunSummary,
  LoadThresholdResult,
} from "@goodgirl/shared";
import type { K6RawGroup, K6RawMetric, K6SummaryJson } from "./types.js";

/**
 * Recursively extracts checks from k6 root_group and nested groups.
 */
function extractChecks(group?: K6RawGroup): LoadCheckResult[] {
  if (!group) return [];
  const results: LoadCheckResult[] = [];

  if (group.checks) {
    for (const [key, check] of Object.entries(group.checks)) {
      const passes = check.passes ?? 0;
      const fails = check.fails ?? 0;
      const total = passes + fails;
      const successRate = total > 0 ? (passes / total) * 100 : 0;

      results.push({
        name: check.name || key,
        path: check.path || key,
        passes,
        fails,
        successRate,
      });
    }
  }

  if (group.groups) {
    for (const subGroup of Object.values(group.groups)) {
      results.push(...extractChecks(subGroup));
    }
  }

  return results;
}

/**
 * Extracts and maps raw k6 metrics to normalized LoadMetricValue objects.
 */
function extractMetrics(
  rawMetrics: Record<string, K6RawMetric>,
): {
  metrics: Record<string, LoadMetricValue>;
  thresholds: LoadThresholdResult[];
  allThresholdsPassed: boolean;
} {
  const metrics: Record<string, LoadMetricValue> = {};
  const thresholds: LoadThresholdResult[] = [];
  let allThresholdsPassed = true;

  for (const [name, raw] of Object.entries(rawMetrics)) {
    // Determine metric type
    let type: LoadMetricValue["type"] = "trend";
    if (raw.type) {
      type = raw.type;
    } else if (raw.avg !== undefined || raw.med !== undefined || raw["p(90)"] !== undefined) {
      type = "trend";
    } else if (name === "http_req_failed" || (raw.passes !== undefined && raw.fails !== undefined)) {
      type = "rate";
    } else if (raw.count !== undefined) {
      type = "counter";
    } else if (raw.value !== undefined) {
      type = "gauge";
    }

    const metricVal: LoadMetricValue = {
      name,
      type,
      avg: raw.avg,
      min: raw.min,
      med: raw.med,
      max: raw.max,
      p90: raw["p(90)"],
      p95: raw["p(95)"],
      p99: raw["p(99)"],
      count: raw.count,
      rate: raw.rate,
      value: raw.value,
      passes: raw.passes,
      fails: raw.fails,
      thresholds: raw.thresholds,
    };

    metrics[name] = metricVal;

    // Evaluate thresholds: in k6 summary JSON, true means threshold was CROSSED (failed)
    if (raw.thresholds) {
      for (const [expr, crossed] of Object.entries(raw.thresholds)) {
        const passed = !crossed;
        if (!passed) {
          allThresholdsPassed = false;
        }
        thresholds.push({
          metric: name,
          expression: expr,
          passed,
        });
      }
    }
  }

  return { metrics, thresholds, allThresholdsPassed };
}

/**
 * Parses a k6 summary export JSON file into a structured LoadRunSummary.
 */
export function parseK6SummaryJson(
  summaryJsonPath: string,
  scriptPath: string,
  durationMs: number,
  exitCode: number,
): LoadRunSummary {
  if (!existsSync(summaryJsonPath)) {
    return {
      script: scriptPath,
      durationMs,
      timestamp: new Date().toISOString(),
      exitCode,
      success: exitCode === 0,
      thresholdsPassed: exitCode !== 99,
      metrics: {},
      checks: [],
      thresholds: [],
      resultsJsonPath: summaryJsonPath,
    };
  }

  try {
    const rawContent = readFileSync(summaryJsonPath, "utf-8");
    const json: K6SummaryJson = JSON.parse(rawContent);

    const checks = extractChecks(json.root_group);
    const { metrics, thresholds, allThresholdsPassed } = extractMetrics(json.metrics ?? {});

    // Latency extraction
    let httpReqDuration: LoadHttpLatencySummary | undefined;
    const dur = metrics["http_req_duration"];
    if (dur && dur.avg !== undefined) {
      httpReqDuration = {
        avg: dur.avg ?? 0,
        min: dur.min ?? 0,
        med: dur.med ?? 0,
        max: dur.max ?? 0,
        p90: dur.p90 ?? 0,
        p95: dur.p95 ?? 0,
        p99: dur.p99,
      };
    }

    // Requests extraction
    let httpReqs: { count: number; rate: number } | undefined;
    const reqs = metrics["http_reqs"];
    if (reqs && reqs.count !== undefined) {
      httpReqs = {
        count: reqs.count,
        rate: reqs.rate ?? 0,
      };
    }

    // Failed requests extraction
    let httpReqFailed: { rate: number; passes: number; fails: number } | undefined;
    const failed = metrics["http_req_failed"];
    if (failed) {
      const rateVal = failed.rate ?? (failed.value !== undefined ? failed.value : 0);
      httpReqFailed = {
        rate: rateVal,
        passes: failed.passes ?? 0,
        fails: failed.fails ?? 0,
      };
    }

    // VUs extraction
    let vus: { value: number; min: number; max: number } | undefined;
    const vusMetric = metrics["vus"];
    const vusMaxMetric = metrics["vus_max"];
    if (vusMetric || vusMaxMetric) {
      vus = {
        value: vusMetric?.value ?? 0,
        min: vusMetric?.min ?? 0,
        max: vusMaxMetric?.max ?? vusMetric?.max ?? 0,
      };
    }

    // Iterations extraction
    let iterations: { count: number; rate: number } | undefined;
    const iterMetric = metrics["iterations"];
    if (iterMetric && iterMetric.count !== undefined) {
      iterations = {
        count: iterMetric.count,
        rate: iterMetric.rate ?? 0,
      };
    }

    // Data sent / received
    let dataSent: { count: number; rate: number } | undefined;
    const sent = metrics["data_sent"];
    if (sent && sent.count !== undefined) {
      dataSent = { count: sent.count, rate: sent.rate ?? 0 };
    }

    let dataReceived: { count: number; rate: number } | undefined;
    const received = metrics["data_received"];
    if (received && received.count !== undefined) {
      dataReceived = { count: received.count, rate: received.rate ?? 0 };
    }

    // A run is successful ONLY if exitCode is 0 AND all thresholds passed
    // k6 exits with 99 on threshold failure
    const success = exitCode === 0 && allThresholdsPassed;

    return {
      script: scriptPath,
      durationMs,
      timestamp: new Date().toISOString(),
      exitCode,
      success,
      thresholdsPassed: allThresholdsPassed && exitCode !== 99,
      metrics,
      checks,
      thresholds,
      httpReqDuration,
      httpReqs,
      httpReqFailed,
      vus,
      iterations,
      dataSent,
      dataReceived,
      resultsJsonPath: summaryJsonPath,
    };
  } catch {
    return {
      script: scriptPath,
      durationMs,
      timestamp: new Date().toISOString(),
      exitCode,
      success: exitCode === 0,
      thresholdsPassed: exitCode !== 99,
      metrics: {},
      checks: [],
      thresholds: [],
      resultsJsonPath: summaryJsonPath,
    };
  }
}
