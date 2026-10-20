import { stringify } from "yaml";
import type { ZapAutomationPlan } from "./types.js";

export interface BaselinePlanOptions {
  targetUrl: string;
  reportDir?: string;
  reportFile?: string;
  maxDurationMins?: number;
  maxDepth?: number;
  maxChildren?: number;
}

export interface ApiPlanOptions {
  apiFileOrUrl: string;
  targetUrl?: string;
  reportDir?: string;
  reportFile?: string;
}

export interface ActiveScanPlanOptions {
  targetUrl: string;
  reportDir?: string;
  reportFile?: string;
  maxScanDurationMins?: number;
  policy?: string;
}

/**
 * Builds a valid ZAP Automation Framework YAML plan for passive baseline scanning.
 */
export function buildBaselinePlan(options: BaselinePlanOptions): string {
  const {
    targetUrl,
    reportDir = "/zap/wrk/goodgirl-results",
    reportFile = "zap-report",
    maxDurationMins = 2,
    maxDepth = 3,
    maxChildren = 20,
  } = options;

  const plan: ZapAutomationPlan = {
    env: {
      contexts: [
        {
          name: "GoodGirl-Baseline-Target",
          urls: [targetUrl],
          includePaths: [`${targetUrl.replace(/\/$/, "")}.*`],
        },
      ],
      parameters: {
        failOnError: true,
        failOnWarning: false,
        progressToStdout: true,
      },
    },
    jobs: [
      {
        type: "passiveScan-config",
        parameters: {
          maxAlertsPerRule: 10,
          scanOnlyInScope: true,
          maxBodySizeInBytes: 0,
        },
      },
      {
        type: "spider",
        parameters: {
          context: "GoodGirl-Baseline-Target",
          user: "",
          url: targetUrl,
          maxDuration: maxDurationMins,
          maxDepth,
          maxChildren,
        },
      },
      {
        type: "passiveScan-wait",
        parameters: {
          maxDuration: 2,
        },
      },
      {
        type: "report",
        parameters: {
          template: "traditional-json",
          reportDir,
          reportFile,
          reportTitle: "GoodGirl ZAP Baseline Security Report",
          reportDescription: "Automated baseline passive security analysis performed by GoodGirl CLI",
        },
      },
      {
        type: "report",
        parameters: {
          template: "traditional-html",
          reportDir,
          reportFile,
          reportTitle: "GoodGirl ZAP Baseline Security Report",
          reportDescription: "Automated baseline passive security analysis performed by GoodGirl CLI",
        },
      },
    ],
  };

  return stringify(plan);
}

/**
 * Builds a valid ZAP Automation Framework YAML plan for OpenAPI endpoint security testing.
 */
export function buildApiPlan(options: ApiPlanOptions): string {
  const {
    apiFileOrUrl,
    targetUrl,
    reportDir = "/zap/wrk/goodgirl-results",
    reportFile = "zap-report",
  } = options;

  const contextUrl = targetUrl ?? "http://127.0.0.1:4173";

  const plan: ZapAutomationPlan = {
    env: {
      contexts: [
        {
          name: "GoodGirl-API-Target",
          urls: [contextUrl],
          includePaths: [`${contextUrl.replace(/\/$/, "")}.*`],
        },
      ],
      parameters: {
        failOnError: true,
        failOnWarning: false,
        progressToStdout: true,
      },
    },
    jobs: [
      {
        type: "passiveScan-config",
        parameters: {
          maxAlertsPerRule: 10,
          scanOnlyInScope: true,
        },
      },
      {
        type: "openapi",
        parameters: {
          apiFile: apiFileOrUrl.startsWith("http://") || apiFileOrUrl.startsWith("https://") ? "" : apiFileOrUrl,
          apiUrl: apiFileOrUrl.startsWith("http://") || apiFileOrUrl.startsWith("https://") ? apiFileOrUrl : "",
          targetUrl: contextUrl,
          context: "GoodGirl-API-Target",
        },
      },
      {
        type: "passiveScan-wait",
        parameters: {
          maxDuration: 2,
        },
      },
      {
        type: "report",
        parameters: {
          template: "traditional-json",
          reportDir,
          reportFile,
          reportTitle: "GoodGirl ZAP API Security Report",
          reportDescription: "OpenAPI endpoint security assessment performed by GoodGirl CLI",
        },
      },
      {
        type: "report",
        parameters: {
          template: "traditional-html",
          reportDir,
          reportFile,
          reportTitle: "GoodGirl ZAP API Security Report",
          reportDescription: "OpenAPI endpoint security assessment performed by GoodGirl CLI",
        },
      },
    ],
  };

  return stringify(plan);
}

/**
 * Builds a valid ZAP Automation Framework YAML plan for authorized active scanning.
 */
export function buildActiveScanPlan(options: ActiveScanPlanOptions): string {
  const {
    targetUrl,
    reportDir = "/zap/wrk/goodgirl-results",
    reportFile = "zap-report",
    maxScanDurationMins = 3,
    policy = "Default Policy",
  } = options;

  const plan: ZapAutomationPlan = {
    env: {
      contexts: [
        {
          name: "GoodGirl-Active-Target",
          urls: [targetUrl],
          includePaths: [`${targetUrl.replace(/\/$/, "")}.*`],
        },
      ],
      parameters: {
        failOnError: true,
        failOnWarning: false,
        progressToStdout: true,
      },
    },
    jobs: [
      {
        type: "spider",
        parameters: {
          context: "GoodGirl-Active-Target",
          user: "",
          url: targetUrl,
          maxDuration: 2,
          maxDepth: 3,
        },
      },
      {
        type: "passiveScan-wait",
        parameters: {
          maxDuration: 1,
        },
      },
      {
        type: "activeScan",
        parameters: {
          context: "GoodGirl-Active-Target",
          user: "",
          policy,
          maxRuleDurationInMins: 1,
          maxScanDurationInMins: maxScanDurationMins,
        },
      },
      {
        type: "report",
        parameters: {
          template: "traditional-json",
          reportDir,
          reportFile,
          reportTitle: "GoodGirl ZAP Active Security Report",
          reportDescription: "Authorized active security assessment performed by GoodGirl CLI",
        },
      },
      {
        type: "report",
        parameters: {
          template: "traditional-html",
          reportDir,
          reportFile,
          reportTitle: "GoodGirl ZAP Active Security Report",
          reportDescription: "Authorized active security assessment performed by GoodGirl CLI",
        },
      },
    ],
  };

  return stringify(plan);
}
