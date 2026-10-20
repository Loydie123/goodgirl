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

  it("rejects invalid browser type", () => {
    const invalid = { browser: "safari" };
    const result = goodGirlConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("GoodGirl Doctor Checker", () => {
  it("runs environment checks and verifies Node runtime", async () => {
    const report = await runDoctorChecks(process.cwd());
    expect(report.checks.length).toBeGreaterThanOrEqual(4);
    const nodeCheck = report.checks.find((c) => c.name === "Node.js Runtime");
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck?.status).toBe("pass");
  });
});
