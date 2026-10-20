import { describe, expect, it } from "vitest";
import type { SecurityRunSummary } from "@goodgirl/shared";
import {
  formatSecurityTerminalSummary,
  redactSensitiveData,
} from "./security-terminal.js";

describe("Security Terminal Reporter", () => {
  it("redacts sensitive authorization tokens and passwords", () => {
    const raw = "Headers: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret and password=supersecretpass";
    const redacted = redactSensitiveData(raw);
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(redacted).not.toContain("supersecretpass");
    expect(redacted).toContain("***REDACTED***");
  });

  it("formats a security summary card string accurately", () => {
    const summary: SecurityRunSummary = {
      target: "http://127.0.0.1:4173",
      durationMs: 8400,
      timestamp: new Date().toISOString(),
      exitCode: 0,
      success: true,
      thresholdPassed: true,
      riskSummary: {
        high: 0,
        medium: 1,
        low: 1,
        informational: 2,
        total: 4,
      },
      alerts: [
        {
          pluginId: "10038",
          name: "Content Security Policy (CSP) Header Not Set",
          risk: "Medium",
          riskCode: 2,
          confidence: "High",
          description: "CSP header is not set.",
          solution: "Set CSP header.",
          cweId: "693",
          instances: [
            {
              uri: "http://127.0.0.1:4173/",
              method: "GET",
            },
          ],
          count: 1,
        },
      ],
      engine: {
        type: "docker",
        image: "ghcr.io/zaproxy/zaproxy:stable",
      },
      reportPathHtml: "/path/to/zap-report.html",
      reportPathJson: "/path/to/zap-report.json",
    };

    const output = formatSecurityTerminalSummary(summary);
    expect(output).toContain("GoodGirl Security Test Summary (OWASP ZAP)");
    expect(output).toContain("http://127.0.0.1:4173");
    expect(output).toContain("PASSED");
    expect(output).toContain("Content Security Policy (CSP) Header Not Set");
    expect(output).toContain("CWE-693");
    expect(output).toContain("zap-report.html");
  });
});
