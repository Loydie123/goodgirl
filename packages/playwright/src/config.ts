import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";
import type { GoodGirlConfig } from "@goodgirl/shared";
import {
  DEFAULT_BASE_URL,
  DEFAULT_BROWSER,
  DEFAULT_RESULTS_DIR,
  DEFAULT_RETRIES,
  DEFAULT_SCREENSHOT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TRACE,
  getResultsPaths,
} from "@goodgirl/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveFixtureServerScript(): string {
  const candidates = [
    resolve(__dirname, "..", "dist", "fixture-server.js"),
    resolve(__dirname, "fixture-server.js"),
    resolve(__dirname, "dist", "fixture-server.js"),
  ];
  for (const cand of candidates) {
    if (existsSync(cand)) {
      return cand;
    }
  }
  return resolve(__dirname, "..", "dist", "fixture-server.js");
}

export function createPlaywrightConfig(
  cwd: string = process.cwd(),
  customConfig?: Partial<GoodGirlConfig>,
): PlaywrightTestConfig {
  const merged: GoodGirlConfig = {
    projectName: customConfig?.projectName ?? "GoodGirl QA Project",
    baseURL: customConfig?.baseURL ?? DEFAULT_BASE_URL,
    browser: customConfig?.browser ?? DEFAULT_BROWSER,
    timeout: customConfig?.timeout ?? DEFAULT_TIMEOUT_MS,
    retries: customConfig?.retries ?? DEFAULT_RETRIES,
    screenshots: customConfig?.screenshots ?? DEFAULT_SCREENSHOT,
    trace: customConfig?.trace ?? DEFAULT_TRACE,
    testDir: customConfig?.testDir ?? (customConfig ? "tests" : "."),
    resultsDir: customConfig?.resultsDir ?? DEFAULT_RESULTS_DIR,
    webServer: customConfig?.webServer,
  };

  const { jsonReportPath, htmlReportDir } = getResultsPaths(cwd, merged.resultsDir);

  const fixtureServerScript = resolveFixtureServerScript();

  // Determine webServer configuration
  let webServerConfig = undefined;
  if (merged.webServer) {
    webServerConfig = {
      command: merged.webServer.command,
      port: merged.webServer.port,
      url: merged.webServer.url ?? merged.baseURL,
      reuseExistingServer: merged.webServer.reuseExistingServer ?? !process.env.CI,
      timeout: merged.webServer.timeout ?? 15000,
    };
  } else if (merged.baseURL?.includes("4173")) {
    // Default built-in fixture server for local hermetic testing
    webServerConfig = {
      command: `"${process.execPath}" "${fixtureServerScript}" 4173`,
      url: "http://127.0.0.1:4173/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    };
  }

  return defineConfig({
    testDir: merged.testDir ? resolve(cwd, merged.testDir) : cwd,
    timeout: merged.timeout,
    retries: process.env.CI ? Math.max(merged.retries ?? 1, 1) : (merged.retries ?? 0),
    workers: process.env.CI ? 1 : undefined,
    reporter: [
      ["list"],
      ["json", { outputFile: jsonReportPath }],
      ["html", { outputFolder: htmlReportDir, open: "never" }],
    ],
    use: {
      baseURL: merged.baseURL,
      browserName: merged.browser,
      screenshot: merged.screenshots,
      trace: merged.trace,
      headless: true,
    },
    projects: [
      {
        name: "e2e",
        testMatch: [
          "**/e2e/**/*.spec.ts",
          "**/e2e/**/*.test.ts",
          "**/*.e2e.spec.ts",
          "**/*.e2e.test.ts",
        ],
      },
      {
        name: "api",
        testMatch: [
          "**/api/**/*.spec.ts",
          "**/api/**/*.test.ts",
          "**/*.api.spec.ts",
          "**/*.api.test.ts",
        ],
      },
    ],
    webServer: webServerConfig,
  });
}
