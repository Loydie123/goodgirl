import { describe, expect, it } from "vitest";
import { parsePlaywrightJsonReport } from "./parser.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Playwright JSON report parser", () => {
  it("handles missing report file gracefully", () => {
    const summary = parsePlaywrightJsonReport("/non/existent/path/results.json");
    expect(summary.total).toBe(0);
    expect(summary.success).toBe(false);
    expect(summary.failures.length).toBeGreaterThan(0);
  });

  it("parses valid Playwright JSON report accurately", () => {
    const mockReport = {
      config: {},
      errors: [],
      stats: {
        startTime: "2026-10-20T00:00:00.000Z",
        duration: 1250,
        expected: 2,
        unexpected: 1,
        flaky: 0,
        skipped: 1,
      },
      suites: [
        {
          title: "sample.spec.ts",
          file: "tests/sample.spec.ts",
          specs: [
            {
              title: "successful test",
              ok: true,
              tests: [{ status: "expected", results: [{ status: "passed", duration: 100, errors: [] }] }],
            },
            {
              title: "skipped test",
              ok: true,
              tests: [{ status: "skipped", results: [{ status: "skipped", duration: 0, errors: [] }] }],
            },
            {
              title: "failing test",
              ok: false,
              tests: [
                {
                  status: "unexpected",
                  results: [
                    {
                      status: "failed",
                      duration: 200,
                      errors: [{ message: "Expected 200 but received 500" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const tempPath = join(tmpdir(), `goodgirl-test-${Date.now()}.json`);
    writeFileSync(tempPath, JSON.stringify(mockReport), "utf-8");

    try {
      const summary = parsePlaywrightJsonReport(tempPath, "/tmp/html");
      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.durationMs).toBe(1250);
      expect(summary.success).toBe(false);
      expect(summary.failures).toHaveLength(1);
      expect(summary.failures[0]?.title).toBe("failing test");
      expect(summary.failures[0]?.error).toContain("Expected 200 but received 500");
    } finally {
      unlinkSync(tempPath);
    }
  });
});
