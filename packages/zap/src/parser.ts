import { existsSync, readFileSync } from "node:fs";
import type {
  SecurityAlert,
  SecurityAlertInstance,
  SecurityRiskSummary,
  ZapConfidenceLevel,
  ZapRiskLevel,
} from "@goodgirl/shared";
import type {
  ZapRawAlert,
  ZapRawReport,
  ZapRawSite,
} from "./types.js";

/**
 * Converts ZAP numerical risk code into standardized ZapRiskLevel.
 */
export function mapRiskCodeToLevel(code: string | number): ZapRiskLevel {
  const num = typeof code === "string" ? parseInt(code, 10) : code;
  switch (num) {
    case 3:
      return "High";
    case 2:
      return "Medium";
    case 1:
      return "Low";
    case 0:
    default:
      return "Informational";
  }
}

/**
 * Converts ZAP numerical confidence code into standardized ZapConfidenceLevel.
 */
export function mapConfidenceCodeToLevel(code: string | number): ZapConfidenceLevel {
  const num = typeof code === "string" ? parseInt(code, 10) : code;
  switch (num) {
    case 4:
      return "User Confirmed";
    case 3:
      return "High";
    case 2:
      return "Medium";
    case 1:
      return "Low";
    case 0:
    default:
      return "False Positive";
  }
}

export interface ParseZapReportOptions {
  failOnRisk?: ZapRiskLevel | "never";
}

export interface ParsedZapReport {
  alerts: SecurityAlert[];
  riskSummary: SecurityRiskSummary;
  thresholdPassed: boolean;
  generatedAt?: string;
  zapVersion?: string;
}

/**
 * Parses ZAP JSON report (from file or string) into structured security findings.
 */
export function parseZapJsonReport(
  rawContentOrPath: string,
  options: ParseZapReportOptions = {},
): ParsedZapReport {
  let jsonString = rawContentOrPath;

  if (existsSync(rawContentOrPath)) {
    jsonString = readFileSync(rawContentOrPath, "utf-8");
  }

  let rawReport: ZapRawReport;
  try {
    rawReport = JSON.parse(jsonString) as ZapRawReport;
  } catch (err) {
    throw new Error(`Failed to parse ZAP JSON report: ${err instanceof Error ? err.message : String(err)}`);
  }

  const sites: ZapRawSite[] = Array.isArray(rawReport.site)
    ? rawReport.site
    : rawReport.site
      ? [rawReport.site]
      : [];

  const alertMap = new Map<string, SecurityAlert>();

  for (const site of sites) {
    const rawAlerts: ZapRawAlert[] = site.alerts ?? [];

    for (const raw of rawAlerts) {
      const pluginId = String(raw.pluginid ?? "0");
      const name = raw.alert || raw.name || "Unknown Alert";
      const riskCode = parseInt(String(raw.riskcode ?? "0"), 10);
      const risk = mapRiskCodeToLevel(riskCode);
      const confidence = mapConfidenceCodeToLevel(raw.confidence ?? "1");

      const instances: SecurityAlertInstance[] = (raw.instances ?? []).map((inst) => ({
        uri: inst.uri ?? site["@name"] ?? "",
        method: inst.method ?? "GET",
        param: inst.param || undefined,
        attack: inst.attack || undefined,
        evidence: inst.evidence || undefined,
      }));

      const existing = alertMap.get(pluginId);
      if (existing) {
        existing.instances.push(...instances);
        existing.count = existing.instances.length;
      } else {
        alertMap.set(pluginId, {
          pluginId,
          name,
          risk,
          riskCode,
          confidence,
          description: raw.desc?.trim() ?? "",
          solution: raw.solution?.trim() ?? "",
          cweId: raw.cweid || undefined,
          wascId: raw.wascid || undefined,
          reference: raw.reference?.trim() || undefined,
          instances,
          count: instances.length > 0 ? instances.length : 1,
        });
      }
    }
  }

  // Sort alerts: Highest risk first (3 down to 0), then by count
  const alerts = Array.from(alertMap.values()).sort((a, b) => {
    if (b.riskCode !== a.riskCode) {
      return b.riskCode - a.riskCode;
    }
    return b.count - a.count;
  });

  const riskSummary: SecurityRiskSummary = {
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
    total: alerts.length,
  };

  for (const a of alerts) {
    switch (a.risk) {
      case "High":
        riskSummary.high++;
        break;
      case "Medium":
        riskSummary.medium++;
        break;
      case "Low":
        riskSummary.low++;
        break;
      case "Informational":
      default:
        riskSummary.informational++;
        break;
    }
  }

  // Threshold evaluation
  const failOnRisk = options.failOnRisk ?? "High";
  let thresholdPassed = true;

  if (failOnRisk === "never") {
    thresholdPassed = true;
  } else if (failOnRisk === "High") {
    thresholdPassed = riskSummary.high === 0;
  } else if (failOnRisk === "Medium") {
    thresholdPassed = riskSummary.high === 0 && riskSummary.medium === 0;
  } else if (failOnRisk === "Low") {
    thresholdPassed =
      riskSummary.high === 0 && riskSummary.medium === 0 && riskSummary.low === 0;
  } else if (failOnRisk === "Informational") {
    thresholdPassed = riskSummary.total === 0;
  }

  return {
    alerts,
    riskSummary,
    thresholdPassed,
    generatedAt: rawReport["@generated"],
    zapVersion: rawReport["@version"],
  };
}
