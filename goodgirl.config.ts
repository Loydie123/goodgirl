import type { GoodGirlConfig } from "@goodgirl/shared";

const config: GoodGirlConfig = {
  projectName: "GoodGirl Monorepo Test Bench",
  baseURL: "http://127.0.0.1:4173",
  browser: "chromium",
  timeout: 30000,
  retries: 1,
  screenshots: "only-on-failure",
  trace: "retain-on-failure",
  testDir: "packages/playwright/tests",
  resultsDir: "goodgirl-results",
};

export default config;
