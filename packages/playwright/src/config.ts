import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig, devices, type PlaywrightTestConfig, type Project } from "@playwright/test";
import type { GoodGirlConfig } from "@goodgirl/shared";
import {
  DEFAULT_BASE_URL,
  DEFAULT_BROWSER,
  DEFAULT_RESULTS_DIR,
  DEFAULT_RETRIES,
  DEFAULT_SCREENSHOT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TRACE,
  DEFAULT_VIDEO,
  getResultsPaths,
} from "@goodgirl/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const E2E_TEST_MATCH = [
  "**/e2e/**/*.spec.ts",
  "**/e2e/**/*.spec.js",
  "**/e2e/**/*.test.ts",
  "**/e2e/**/*.test.js",
  "**/*.e2e.spec.ts",
  "**/*.e2e.spec.js",
  "**/*.e2e.test.ts",
  "**/*.e2e.test.js",
];

const API_TEST_MATCH = [
  "**/api/**/*.spec.ts",
  "**/api/**/*.spec.js",
  "**/api/**/*.test.ts",
  "**/api/**/*.test.js",
  "**/*.api.spec.ts",
  "**/*.api.spec.js",
  "**/*.api.test.ts",
  "**/*.api.test.js",
];

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
    browsers: customConfig?.browsers,
    projects: customConfig?.projects,
    timeout: customConfig?.timeout ?? DEFAULT_TIMEOUT_MS,
    retries: customConfig?.retries ?? DEFAULT_RETRIES,
    workers: customConfig?.workers,
    fullyParallel: customConfig?.fullyParallel,
    screenshots: customConfig?.screenshots ?? DEFAULT_SCREENSHOT,
    trace: customConfig?.trace ?? DEFAULT_TRACE,
    video: customConfig?.video ?? DEFAULT_VIDEO,
    testDir: customConfig?.testDir ?? (customConfig ? "tests" : "."),
    resultsDir: customConfig?.resultsDir ?? DEFAULT_RESULTS_DIR,
    webServer: customConfig?.webServer,
    use: customConfig?.use,
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

  // Construct projects based on user configuration
  let projects: Project[] = [];

  if (merged.projects && merged.projects.length > 0) {
    projects = merged.projects.map((p) => {
      const devicePreset = p.device && devices[p.device] ? devices[p.device] : {};
      return {
        name: p.name,
        testMatch: p.testMatch ?? (p.name.includes("api") ? API_TEST_MATCH : E2E_TEST_MATCH),
        testIgnore: p.testIgnore,
        use: {
          ...devicePreset,
          ...(p.browser ? { browserName: p.browser } : {}),
          ...(p.use ?? {}),
        },
      };
    });
  } else if (merged.browsers && merged.browsers.length > 0) {
    // Generate multi-browser projects
    for (const b of merged.browsers) {
      const devicePreset =
        b === "chromium"
          ? devices["Desktop Chrome"]
          : b === "firefox"
            ? devices["Desktop Firefox"]
            : devices["Desktop Safari"];

      projects.push({
        name: b,
        testMatch: E2E_TEST_MATCH,
        use: {
          ...devicePreset,
          browserName: b,
        },
      });
    }
    // Always include API suite project
    projects.push({
      name: "api",
      testMatch: API_TEST_MATCH,
      use: {},
    });
  } else {
    // Default single-browser setup
    projects = [
      {
        name: "e2e",
        testMatch: E2E_TEST_MATCH,
        use: {
          browserName: merged.browser,
        },
      },
      {
        name: "api",
        testMatch: API_TEST_MATCH,
        use: {},
      },
    ];
  }

  return defineConfig({
    testDir: merged.testDir ? resolve(cwd, merged.testDir) : cwd,
    timeout: merged.timeout,
    retries: process.env.CI ? Math.max(merged.retries ?? 1, 1) : (merged.retries ?? 0),
    workers: merged.workers !== undefined ? merged.workers : (process.env.CI ? 1 : undefined),
    fullyParallel: merged.fullyParallel ?? false,
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
      video: merged.video,
      headless: true,
      ...(merged.use ?? {}),
    },
    projects,
    webServer: webServerConfig,
  });
}

