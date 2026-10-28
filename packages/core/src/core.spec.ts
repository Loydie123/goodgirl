import { describe, expect, it } from "vitest";
import { goodGirlConfigSchema } from "./config/schema.js";
import { runDoctorChecks } from "./doctor/checker.js";

describe("GoodGirl Core Config", () => {
  it("provides sensible defaults for empty config", () => {
    const parsed = goodGirlConfigSchema.parse({});
    expect(parsed.projectName).toBe("GoodGirl QA Project");
    expect(parsed.browser).toBe("chromium");
    expect(parsed.timeout).toBe(30000);
    expect(parsed.retries).toBe(1);
    expect(parsed.screenshots).toBe("only-on-failure");
    expect(parsed.trace).toBe("retain-on-failure");
  });

  it("validates custom valid configuration", () => {
    const custom = {
      projectName: "Custom App QA",
      baseURL: "http://localhost:3000",
      browser: "firefox" as const,
      timeout: 10000,
      retries: 2,
    };
    const parsed = goodGirlConfigSchema.parse(custom);
    expect(parsed.projectName).toBe("Custom App QA");
    expect(parsed.browser).toBe("firefox");
    expect(parsed.timeout).toBe(10000);
    expect(parsed.retries).toBe(2);
  });

  it("validates multi-browser and custom project configurations", () => {
    const config = {
      projectName: "Multi-Browser QA",
      browsers: ["chromium" as const, "firefox" as const, "webkit" as const],
      workers: 4,
      fullyParallel: true,
      video: "on" as const,
      projects: [
        {
          name: "Mobile Safari",
          device: "iPhone 13",
        },
      ],
    };
    const parsed = goodGirlConfigSchema.parse(config);
    expect(parsed.browsers).toHaveLength(3);
    expect(parsed.workers).toBe(4);
    expect(parsed.fullyParallel).toBe(true);
    expect(parsed.video).toBe("on");
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects?.[0]?.name).toBe("Mobile Safari");
  });
});

import { buildPlaywrightArgs } from "./runner/orchestrator.js";

describe("Playwright Argument Builder", () => {
  it("builds default arguments with config path", () => {
    const args = buildPlaywrightArgs(["node", "cli.js"], "/path/to/playwright.config.ts", {
      type: "all",
    });
    expect(args).toEqual(["node", "cli.js", "test", "--config=/path/to/playwright.config.ts"]);
  });

  it("builds arguments for specific project, browser, workers, and grep", () => {
    const args = buildPlaywrightArgs(["node", "cli.js"], "/path/to/playwright.config.ts", {
      type: "e2e",
      browser: "firefox",
      workers: 2,
      grep: "auth",
      grepInvert: "slow",
      headed: true,
    });
    expect(args).toContain("--project=e2e");
    expect(args).not.toContain("--browser=firefox"); // applied to config to preserve named projects
    expect(args).toContain("--workers=2");
    expect(args).toContain("--grep=auth");
    expect(args).toContain("--grep-invert=slow");
    expect(args).toContain("--headed");
  });

  it("supports advanced execution options and passthrough arguments", () => {
    const args = buildPlaywrightArgs(["node", "cli.js"], "/path/to/playwright.config.ts", {
      type: "all",
      shard: "1/3",
      repeatEach: 2,
      maxFailures: 1,
      lastFailed: true,
      list: true,
      debug: true,
      files: ["tests/login.spec.ts"],
      passthroughArgs: ["--output=test-results", "--ignore-snapshots"],
    });
    expect(args).toContain("--shard=1/3");
    expect(args).toContain("--repeat-each=2");
    expect(args).toContain("--max-failures=1");
    expect(args).toContain("--last-failed");
    expect(args).toContain("--list");
    expect(args).toContain("--debug");
    expect(args).toContain("tests/login.spec.ts");
    expect(args).toContain("--output=test-results");
    expect(args).toContain("--ignore-snapshots");
  });
});

describe("GoodGirl Doctor Checker", () => {
  it("runs environment checks and verifies Node runtime and browsers", async () => {
    const report = await runDoctorChecks(process.cwd());
    expect(report.checks.length).toBeGreaterThanOrEqual(5);
    const nodeCheck = report.checks.find((c) => c.name === "Node.js Runtime");
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck?.status).toBe("pass");

    const browserCheck = report.checks.find((c) => c.name === "Playwright Browser Engines");
    expect(browserCheck).toBeDefined();
    expect(["pass", "warn"]).toContain(browserCheck?.status);
  });

  it("validates k6 configuration schema", () => {
    const parsed = goodGirlConfigSchema.parse({
      k6: {
        binaryPath: "/usr/local/bin/k6",
        allowedTargets: ["127.0.0.1", "test.k6.io"],
        allowExternalTargets: true,
        defaultVUs: 10,
        defaultDuration: "30s",
        summaryTrendStats: ["avg", "p(90)", "p(95)", "p(99)"],
      },
    });
    expect(parsed.k6).toBeDefined();
    expect(parsed.k6?.defaultVUs).toBe(10);
    expect(parsed.k6?.allowExternalTargets).toBe(true);
    expect(parsed.k6?.allowedTargets).toContain("test.k6.io");
  });

  it("runs load doctor checks specifically for k6", async () => {
    const { runLoadDoctorChecks } = await import("./doctor/checker.js");
    const report = await runLoadDoctorChecks(process.cwd());
    expect(report.checks.length).toBeGreaterThanOrEqual(4);
    const k6Check = report.checks.find((c) => c.name === "k6 Binary Executable");
    expect(k6Check).toBeDefined();
  });

  it("validates security configuration schema", () => {
    const parsed = goodGirlConfigSchema.parse({
      security: {
        dockerImage: "ghcr.io/zaproxy/zaproxy:stable",
        allowedTargets: ["127.0.0.1", "localhost"],
        allowExternal: true,
        failOnRisk: "Medium",
        defaultTimeoutSeconds: 600,
      },
    });
    expect(parsed.security).toBeDefined();
    expect(parsed.security?.dockerImage).toBe("ghcr.io/zaproxy/zaproxy:stable");
    expect(parsed.security?.failOnRisk).toBe("Medium");
    expect(parsed.security?.allowExternal).toBe(true);
    expect(parsed.security?.defaultTimeoutSeconds).toBe(600);
  });

  it("runs security doctor checks specifically for OWASP ZAP", async () => {
    const { runSecurityDoctorChecks } = await import("./doctor/checker.js");
    const report = await runSecurityDoctorChecks(process.cwd());
    expect(report.checks.length).toBeGreaterThanOrEqual(4);
    const zapCheck = report.checks.find(
      (c) => c.name.includes("ZAP") || c.name.includes("Docker"),
    );
    expect(zapCheck).toBeDefined();
  });
});

