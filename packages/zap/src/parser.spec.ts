import { describe, expect, it } from "vitest";
import {
  mapConfidenceCodeToLevel,
  mapRiskCodeToLevel,
  parseZapJsonReport,
} from "./parser.js";

describe("OWASP ZAP Report Parser", () => {
  it("maps numerical risk codes accurately", () => {
    expect(mapRiskCodeToLevel("3")).toBe("High");
    expect(mapRiskCodeToLevel("2")).toBe("Medium");
    expect(mapRiskCodeToLevel("1")).toBe("Low");
    expect(mapRiskCodeToLevel("0")).toBe("Informational");
    expect(mapRiskCodeToLevel(3)).toBe("High");
  });

  it("maps confidence codes accurately", () => {
    expect(mapConfidenceCodeToLevel("4")).toBe("User Confirmed");
    expect(mapConfidenceCodeToLevel("3")).toBe("High");
    expect(mapConfidenceCodeToLevel("2")).toBe("Medium");
    expect(mapConfidenceCodeToLevel("1")).toBe("Low");
    expect(mapConfidenceCodeToLevel("0")).toBe("False Positive");
  });

  it("parses traditional ZAP JSON report content into structured findings", () => {
    const mockJson = JSON.stringify({
      "@version": "2.15.0",
      "@generated": "Tue, 20 Oct 2026 06:40:00",
      site: [
        {
          "@name": "http://127.0.0.1:4173",
          "@host": "127.0.0.1",
          alerts: [
            {
              pluginid: "10038",
              alert: "Content Security Policy (CSP) Header Not Set",
              riskcode: "2",
              confidence: "3",
              riskdesc: "Medium (High)",
              desc: "CSP is an added layer of security.",
              solution: "Ensure CSP header is sent.",
              cweid: "693",
              instances: [
                {
                  uri: "http://127.0.0.1:4173/",
                  method: "GET",
                },
                {
                  uri: "http://127.0.0.1:4173/api/health",
                  method: "GET",
                },
              ],
            },
            {
              pluginid: "10021",
              alert: "X-Content-Type-Options Header Missing",
              riskcode: "1",
              confidence: "2",
              riskdesc: "Low (Medium)",
              desc: "Ensure nosniff is set.",
              solution: "Send X-Content-Type-Options: nosniff",
              cweid: "16",
              instances: [
                {
                  uri: "http://127.0.0.1:4173/",
                  method: "GET",
                },
              ],
            },
          ],
        },
      ],
    });

    const parsed = parseZapJsonReport(mockJson, { failOnRisk: "High" });
    expect(parsed.alerts.length).toBe(2);
    expect(parsed.riskSummary.high).toBe(0);
    expect(parsed.riskSummary.medium).toBe(1);
    expect(parsed.riskSummary.low).toBe(1);
    expect(parsed.riskSummary.informational).toBe(0);
    expect(parsed.riskSummary.total).toBe(2);

    // With failOnRisk: "High", since high === 0, threshold should pass
    expect(parsed.thresholdPassed).toBe(true);

    // First alert should be the Medium alert (highest risk)
    const firstAlert = parsed.alerts[0];
    expect(firstAlert?.name).toBe("Content Security Policy (CSP) Header Not Set");
    expect(firstAlert?.risk).toBe("Medium");
    expect(firstAlert?.count).toBe(2);
    expect(firstAlert?.instances.length).toBe(2);
  });

  it("fails threshold when alerts meet or exceed failOnRisk level", () => {
    const mockJson = JSON.stringify({
      site: {
        "@name": "http://127.0.0.1:4173",
        alerts: [
          {
            pluginid: "10038",
            alert: "Content Security Policy (CSP) Header Not Set",
            riskcode: "2", // Medium
            confidence: "3",
          },
        ],
      },
    });

    // failOnRisk: "Medium" should fail because there is 1 Medium alert
    const parsedMedium = parseZapJsonReport(mockJson, { failOnRisk: "Medium" });
    expect(parsedMedium.thresholdPassed).toBe(false);

    // failOnRisk: "never" should always pass
    const parsedNever = parseZapJsonReport(mockJson, { failOnRisk: "never" });
    expect(parsedNever.thresholdPassed).toBe(true);
  });
});
