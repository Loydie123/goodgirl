import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CONFIG_FILE_NAMES,
  DEFAULT_HTML_REPORT_DIR_NAME,
  DEFAULT_JSON_REPORT_NAME,
  DEFAULT_K6_RESULTS_NAME,
  DEFAULT_RESULTS_DIR,
} from "./constants.js";

/**
 * Normalizes any Windows or POSIX path safely.
 */
export function normalizeCrossPlatformPath(rawPath: string): string {
  return normalize(rawPath);
}

/**
 * Resolves a configuration path given a working directory or explicit file path.
 */
export function resolveConfigPath(cwd: string, explicitPath?: string): string | null {
  if (explicitPath) {
    const candidate = isAbsolute(explicitPath) ? explicitPath : resolve(cwd, explicitPath);
    return existsSync(candidate) ? candidate : null;
  }

  for (const name of CONFIG_FILE_NAMES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Synchronously ensures a directory exists without throwing if already present.
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Converts a path to a file:// URL format cross-platform.
 */
export function toFileUrlString(filePath: string): string {
  return pathToFileURL(resolve(filePath)).href;
}

/**
 * Computes standard report and artifact paths for a test run.
 */
export function getResultsPaths(
  cwd: string,
  customResultsDir?: string,
): {
  resultsDir: string;
  jsonReportPath: string;
  htmlReportDir: string;
} {
  const resultsDir = resolve(cwd, customResultsDir ?? DEFAULT_RESULTS_DIR);
  return {
    resultsDir,
    jsonReportPath: join(resultsDir, DEFAULT_JSON_REPORT_NAME),
    htmlReportDir: join(resultsDir, DEFAULT_HTML_REPORT_DIR_NAME),
  };
}

/**
 * Computes standard report and artifact paths for a k6 load test run.
 */
export function getK6ResultsPaths(
  cwd: string,
  customResultsDir?: string,
): {
  resultsDir: string;
  k6JsonReportPath: string;
} {
  const resultsDir = resolve(cwd, customResultsDir ?? DEFAULT_RESULTS_DIR);
  return {
    resultsDir,
    k6JsonReportPath: join(resultsDir, DEFAULT_K6_RESULTS_NAME),
  };
}
