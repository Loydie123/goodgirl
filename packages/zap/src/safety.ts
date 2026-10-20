import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_ALLOWED_HOSTS } from "@goodgirl/shared";
import type {
  SecurityTargetSafetyOptions,
  SecurityTargetSafetyValidation,
} from "./types.js";

/**
 * Extracts candidate URLs called or targeted in a ZAP Automation Framework YAML plan
 * or target string using regex inspection.
 *
 * NOTE: Static analysis inspects literal URL strings within plan text.
 * Dynamically constructed URLs, environment variable targets, or HTTP redirects
 * cannot be guaranteed detectable statically.
 */
export function extractPlanUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?(?:[^\s"'`)]*)/g;
  const matches = content.match(urlRegex) ?? [];
  return Array.from(new Set(matches));
}

/**
 * Determines whether a given URL hostname points to a permitted local or allowlisted target.
 */
export function isAllowedHost(
  hostname: string,
  allowedList: readonly string[] = DEFAULT_ALLOWED_HOSTS,
): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "host.docker.internal") {
    return true;
  }
  for (const allowed of allowedList) {
    const normAllowed = allowed.toLowerCase();
    if (normalized === normAllowed) {
      return true;
    }
    // Subdomain matching if allowed starts with '.'
    if (normAllowed.startsWith(".") && normalized.endsWith(normAllowed)) {
      return true;
    }
  }
  return false;
}

/**
 * Inspects a ZAP Automation Framework plan content to determine if an activeScan job is declared.
 */
export function containsActiveScanJob(content: string): boolean {
  // Checks for: "type: activeScan" or "type: 'activeScan'" or 'type: "activeScan"'
  const activeScanRegex = /type:\s*['"]?activeScan['"]?/i;
  return activeScanRegex.test(content);
}

/**
 * Validates target endpoint safety and active scan authorizations.
 */
export function validateSecurityPlanSafety(
  planPathOrContent: string,
  options: SecurityTargetSafetyOptions = {},
): SecurityTargetSafetyValidation {
  let content = planPathOrContent;

  if (existsSync(planPathOrContent)) {
    content = readFileSync(planPathOrContent, "utf-8");
  }

  const urls = extractPlanUrls(content);
  const activeScanDetected = containsActiveScanJob(content);

  // 1. Guard against unauthorized Active Scanning
  if (activeScanDetected && !options.allowActive) {
    return {
      safe: false,
      targets: urls,
      blockedTargets: [],
      activeScanDetected: true,
      reason:
        `Security Notice: Active security scanning is declared in the scan plan.\n` +
        `Active scanning sends potentially disruptive or intrusive request payloads to discover vulnerabilities.\n` +
        `To run active security scans, explicit authorization is required.\n` +
        `Provide the "--active" / "--allow-active" CLI flag or enable "security.allowActive: true" in goodgirl.config.ts.`,
    };
  }

  // 2. Validate external hosts
  const allowedHosts = [
    ...DEFAULT_ALLOWED_HOSTS,
    "host.docker.internal",
    ...(options.allowedTargets ?? []),
  ];

  const blocked: string[] = [];

  for (const urlStr of urls) {
    try {
      const parsed = new URL(urlStr);
      if (!isAllowedHost(parsed.hostname, allowedHosts)) {
        blocked.push(urlStr);
      }
    } catch {
      // Ignore unparseable fragments
    }
  }

  if (blocked.length > 0 && !options.allowExternal) {
    return {
      safe: false,
      targets: urls,
      blockedTargets: blocked,
      activeScanDetected,
      reason:
        `Security Notice: Target or plan specifies non-local external host(s):\n` +
        blocked.map((u) => `  - ${u}`).join("\n") +
        `\n\nSecurity scanning external or third-party targets requires explicit permission.\n` +
        `To scan external targets, pass the "--allow-external" flag or configure "security.allowExternal: true" in goodgirl.config.ts.\n\n` +
        `Limitation Notice: Static plan inspection verifies declared literal URLs. It cannot guarantee detection of runtime redirects or dynamic hostnames. Operators are responsible for target authorization.`,
    };
  }

  return {
    safe: true,
    targets: urls,
    blockedTargets: [],
    activeScanDetected,
  };
}
