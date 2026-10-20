import { readFileSync, existsSync } from "node:fs";
import { DEFAULT_ALLOWED_HOSTS } from "@goodgirl/shared";

export interface TargetSafetyValidation {
  safe: boolean;
  targets: string[];
  blockedTargets: string[];
  reason?: string;
}

export interface TargetSafetyOptions {
  allowedTargets?: string[];
  allowExternal?: boolean;
}

/**
 * Extracts candidate URLs called by an HTTP load test script using regex inspection.
 */
export function extractTargetUrls(scriptContent: string): string[] {
  const urlRegex = /https?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?(?:[^\s"'`)]*)/g;
  const matches = scriptContent.match(urlRegex) ?? [];
  return Array.from(new Set(matches));
}

/**
 * Determines whether a URL points to a permitted local or allowlisted target.
 */
export function isAllowedHost(
  hostname: string,
  allowedList: readonly string[] = DEFAULT_ALLOWED_HOSTS,
): boolean {
  const normalized = hostname.toLowerCase();
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
 * Validates a k6 script's target endpoints against allowed hosts.
 */
export function validateScriptTargetSafety(
  scriptPath: string,
  options: TargetSafetyOptions = {},
): TargetSafetyValidation {
  if (!existsSync(scriptPath)) {
    return {
      safe: false,
      targets: [],
      blockedTargets: [],
      reason: `Script file not found: "${scriptPath}"`,
    };
  }

  const content = readFileSync(scriptPath, "utf-8");
  const urls = extractTargetUrls(content);

  const allowedHosts = [
    ...DEFAULT_ALLOWED_HOSTS,
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
      reason:
        `Security Notice: Test script targets non-local external host(s):\n` +
        blocked.map((u) => `  - ${u}`).join("\n") +
        `\n\nLoad testing external or remote endpoints requires explicit authorization.\n` +
        `To run against external targets, pass the "--allow-external" flag or configure "k6.allowExternalTargets: true" in goodgirl.config.ts.`,
    };
  }

  return {
    safe: true,
    targets: urls,
    blockedTargets: [],
  };
}
