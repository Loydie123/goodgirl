import { describe, expect, it, vi } from "vitest";
import { printLoadTerminalSummary } from "./load-terminal.js";
import type { LoadRunSummary } from "@goodgirl/shared";

describe("Load Terminal Summary Formatter", () => {
  it("prints structured load test execution summary without throwing", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const mockSummary: LoadRunSummary = {
      script: "examples/k6/load.js",
      durationMs: 5120,
      timestamp: new Date().toISOString(),
      exitCode: 0,
      success: true,
      thresholdsPassed: true,
      metrics: {
        http_req_duration: {
          name: "http_req_duration",
          type: "trend",
          avg: 45.2,
          min: 12.3,
          med: 42.1,
          max: 120.4,
          p90: 58.0,
          p95: 64.2,
          p99: 88.5,
        },
        custom_ops: {
          name: "custom_ops",
          type: "counter",
          count: 100,
          rate: 20.0,
        },
      },
      checks: [
        {
          name: "status is 200",
          path: "::status is 200",
          passes: 100,
          fails: 0,
          successRate: 100,
        },
      ],
      thresholds: [
        {
          metric: "http_req_duration",
          expression: "p(95)<200",
          passed: true,
        },
      ],
      httpReqDuration: {
        avg: 45.2,
        min: 12.3,
        med: 42.1,
        max: 120.4,
        p90: 58.0,
        p95: 64.2,
        p99: 88.5,
      },
      httpReqs: {
        count: 100,
        rate: 20.0,
      },
      httpReqFailed: {
        rate: 0.0,
        passes: 0,
        fails: 100,
      },
      vus: {
        value: 5,
        min: 1,
        max: 10,
      },
      resultsJsonPath: "/path/to/k6-results.json",
    };

    try {
      printLoadTerminalSummary(mockSummary);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
