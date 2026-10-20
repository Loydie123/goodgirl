import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface ScaffoldOptions {
  cwd?: string;
  projectName?: string;
  baseURL?: string;
  force?: boolean;
}

export interface ScaffoldResult {
  createdFiles: string[];
  skippedFiles: string[];
}

export function scaffoldProject(options: ScaffoldOptions = {}): ScaffoldResult {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  const configPath = join(cwd, "goodgirl.config.ts");
  const configContent = `import type { GoodGirlConfig } from "@goodgirl/shared";

const config: GoodGirlConfig = {
  projectName: "${options.projectName ?? "Sample QA Project"}",
  baseURL: "${options.baseURL ?? "http://127.0.0.1:4173"}",
  browser: "chromium",
  timeout: 30000,
  retries: 1,
  screenshots: "only-on-failure",
  trace: "retain-on-failure",
  testDir: "tests",
  resultsDir: "goodgirl-results",
};

export default config;
`;

  if (!existsSync(configPath) || options.force) {
    writeFileSync(configPath, configContent, "utf-8");
    createdFiles.push("goodgirl.config.ts");
  } else {
    skippedFiles.push("goodgirl.config.ts (already exists)");
  }

  // Create tests directories
  const e2eDir = join(cwd, "tests", "e2e");
  const apiDir = join(cwd, "tests", "api");
  mkdirSync(e2eDir, { recursive: true });
  mkdirSync(apiDir, { recursive: true });

  const sampleE2eFile = join(e2eDir, "sample.spec.ts");
  const sampleE2eContent = `import { test, expect } from "@playwright/test";

test.describe("E2E Starter Suite", () => {
  test("homepage loads and displays main heading", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("interactive user action updates counter", async ({ page }) => {
    await page.goto("/");
    const button = page.locator("#action-btn");
    await button.click();
    await expect(page.locator("#status-message")).toHaveText("Action completed successfully!");
  });
});
`;

  if (!existsSync(sampleE2eFile) || options.force) {
    writeFileSync(sampleE2eFile, sampleE2eContent, "utf-8");
    createdFiles.push("tests/e2e/sample.spec.ts");
  } else {
    skippedFiles.push("tests/e2e/sample.spec.ts (already exists)");
  }

  const sampleApiFile = join(apiDir, "sample.spec.ts");
  const sampleApiContent = `import { test, expect } from "@playwright/test";

test.describe("API Starter Suite", () => {
  test("GET /api/health returns 200 and healthy status", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("timestamp");
  });

  test("POST /api/items rejects invalid payload with 400", async ({ request }) => {
    const response = await request.post("/api/items", {
      data: {},
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Name is required");
  });
});
`;

  if (!existsSync(sampleApiFile) || options.force) {
    writeFileSync(sampleApiFile, sampleApiContent, "utf-8");
    createdFiles.push("tests/api/sample.spec.ts");
  } else {
    skippedFiles.push("tests/api/sample.spec.ts (already exists)");
  }

  return {
    createdFiles,
    skippedFiles,
  };
}
