import { describe, expect, it } from "vitest";
import { parseK6SummaryJson } from "./parser.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

describe("k6 Summary JSON Parser", () => {
  it("handles missing summary file gracefully", () => {
    const summary = parseK6SummaryJson("non-existent-summary.json", "script.js", 1200, 1);
    expect(summary.success).toBe(false);
    expect(summary.exitCode).toBe(1);
    expect(summary.thresholds.length).toBe(0);
    expect(summary.checks.length).toBe(0);
  });

  it("parses valid k6 summary export correctly with metrics and thresholds", () => {
    const tempFile = join(process.cwd(), "temp-parser-test.json");
    const mockJson = {
      root_group: {
        name: "",
        path: "",
        id: "root",
        checks: {
          "status is 200": {
            name: "status is 200",
            path: "::status is 200",
            id: "chk1",
            passes: 50,
            fails: 0,
          },
          "response is fast": {
            name: "response is fast",
            path: "::response is fast",
            id: "chk2",
            passes: 48,
            fails: 2,
          },
        },
      },
      metrics: {
        http_req_duration: {
          avg: 120.5,
          min: 15.2,
          med: 110.0,
          max: 250.8,
          "p(90)": 180.3,
          "p(95)": 210.0,
          "p(99)": 245.5,
          thresholds: {
            "p(95)<300": false, // false means NOT crossed -> passed
          },
        },
        http_reqs: {
          count: 50,
          rate: 10.5,
        },
        http_req_failed: {
          rate: 0.04,
          passes: 2,
          fails: 48,
          thresholds: {
            "rate<0.05": false,
          },
        },
        vus: {
          value: 5,
          min: 1,
          max: 5,
        },
        iterations: {
          count: 50,
          rate: 10.5,
        },
        data_sent: {
          count: 10240,
          rate: 2048,
        },
        data_received: {
          count: 51200,
          rate: 10240,
        },
        custom_trend: {
          avg: 45.0,
          min: 10.0,
          med: 40.0,
          max: 90.0,
          "p(90)": 75.0,
          "p(95)": 85.0,
        },
        custom_counter: {
          count: 15,
          rate: 3.0,
        },
      },
    };

    writeFileSync(tempFile, JSON.stringify(mockJson));

    try {
      const summary = parseK6SummaryJson(tempFile, "examples/k6/load.js", 5000, 0);

      expect(summary.success).toBe(true);
      expect(summary.thresholdsPassed).toBe(true);
      expect(summary.exitCode).toBe(0);

      // Latencies
      expect(summary.httpReqDuration).toBeDefined();
      expect(summary.httpReqDuration?.avg).toBe(120.5);
      expect(summary.httpReqDuration?.med).toBe(110.0);
      expect(summary.httpReqDuration?.p95).toBe(210.0);
      expect(summary.httpReqDuration?.p99).toBe(245.5);

      // Requests & Throughput
      expect(summary.httpReqs?.count).toBe(50);
      expect(summary.httpReqs?.rate).toBe(10.5);

      // Failure rate
      expect(summary.httpReqFailed?.rate).toBe(0.04);

      // VUs
      expect(summary.vus?.max).toBe(5);

      // Checks
      expect(summary.checks.length).toBe(2);
      const chk1 = summary.checks.find((c) => c.name === "status is 200");
      expect(chk1?.passes).toBe(50);
      expect(chk1?.fails).toBe(0);
      expect(chk1?.successRate).toBe(100);

      const chk2 = summary.checks.find((c) => c.name === "response is fast");
      expect(chk2?.passes).toBe(48);
      expect(chk2?.fails).toBe(2);
      expect(chk2?.successRate).toBe(96);

      // Thresholds
      expect(summary.thresholds.length).toBe(2);
      expect(summary.thresholds.every((t) => t.passed)).toBe(true);

      // Custom metrics
      expect(summary.metrics["custom_trend"]).toBeDefined();
      expect(summary.metrics["custom_trend"]?.avg).toBe(45.0);
      expect(summary.metrics["custom_counter"]?.count).toBe(15);
    } finally {
      unlinkSync(tempFile);
    }
  });

  it("marks summary failed when a threshold was crossed", () => {
    const tempFile = join(process.cwd(), "temp-parser-threshold-fail.json");
    const mockJson = {
      root_group: { name: "", path: "", id: "root" },
      metrics: {
        http_req_duration: {
          avg: 500.0,
          "p(95)": 650.0,
          thresholds: {
            "p(95)<200": true, // true means crossed -> FAILED
          },
        },
      },
    };

    writeFileSync(tempFile, JSON.stringify(mockJson));

    try {
      // k6 exits with 99 on threshold failure
      const summary = parseK6SummaryJson(tempFile, "examples/k6/stress.js", 3000, 99);

      expect(summary.success).toBe(false);
      expect(summary.thresholdsPassed).toBe(false);
      expect(summary.exitCode).toBe(99);

      const failedThresh = summary.thresholds.find((t) => t.expression === "p(95)<200");
      expect(failedThresh).toBeDefined();
      expect(failedThresh?.passed).toBe(false);
    } finally {
      unlinkSync(tempFile);
    }
  });
});
