import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  buildActiveScanPlan,
  buildApiPlan,
  buildBaselinePlan,
} from "./plan-builder.js";
import type { ZapAutomationPlan } from "./types.js";

describe("OWASP ZAP Plan Builder", () => {
  it("builds a valid baseline Automation Framework plan", () => {
    const yamlStr = buildBaselinePlan({
      targetUrl: "http://127.0.0.1:4173",
      maxDurationMins: 2,
    });

    const parsed = parse(yamlStr) as ZapAutomationPlan;
    expect(parsed.env.contexts[0]?.urls).toContain("http://127.0.0.1:4173");
    const jobTypes = parsed.jobs.map((j) => j.type);
    expect(jobTypes).toContain("passiveScan-config");
    expect(jobTypes).toContain("spider");
    expect(jobTypes).toContain("passiveScan-wait");
    expect(jobTypes).toContain("report");
  });

  it("builds a valid API Automation Framework plan", () => {
    const yamlStr = buildApiPlan({
      apiFileOrUrl: "/zap/wrk/openapi.json",
      targetUrl: "http://127.0.0.1:4173",
    });

    const parsed = parse(yamlStr) as ZapAutomationPlan;
    expect(parsed.env.contexts[0]?.urls).toContain("http://127.0.0.1:4173");
    const openApiJob = parsed.jobs.find((j) => j.type === "openapi");
    expect(openApiJob).toBeDefined();
    expect(openApiJob?.parameters?.["apiFile"]).toBe("/zap/wrk/openapi.json");
  });

  it("builds a valid active scan Automation Framework plan", () => {
    const yamlStr = buildActiveScanPlan({
      targetUrl: "http://127.0.0.1:4173",
      maxScanDurationMins: 5,
    });

    const parsed = parse(yamlStr) as ZapAutomationPlan;
    const activeJob = parsed.jobs.find((j) => j.type === "activeScan");
    expect(activeJob).toBeDefined();
    expect(activeJob?.parameters?.["maxScanDurationInMins"]).toBe(5);
  });
});
