import { describe, expect, it } from "vitest";
import {
  containsActiveScanJob,
  extractPlanUrls,
  isAllowedHost,
  validateSecurityPlanSafety,
} from "./safety.js";

describe("OWASP ZAP Safety Controls", () => {
  it("extracts target URLs from YAML plan content", () => {
    const yaml = `
      env:
        contexts:
          - urls:
            - "http://127.0.0.1:4173/api"
            - "https://staging.internal.net/v1"
    `;
    const urls = extractPlanUrls(yaml);
    expect(urls).toContain("http://127.0.0.1:4173/api");
    expect(urls).toContain("https://staging.internal.net/v1");
  });

  it("permits local and docker hosts by default", () => {
    expect(isAllowedHost("127.0.0.1")).toBe(true);
    expect(isAllowedHost("localhost")).toBe(true);
    expect(isAllowedHost("host.docker.internal")).toBe(true);
    expect(isAllowedHost("::1")).toBe(true);
    expect(isAllowedHost("unauthorized-remote-site.com")).toBe(false);
  });

  it("detects activeScan jobs within plan content", () => {
    expect(containsActiveScanJob("jobs:\n  - type: spider\n  - type: activeScan")).toBe(true);
    expect(containsActiveScanJob("jobs:\n  - type: spider\n  - type: passiveScan-wait")).toBe(false);
  });

  it("blocks unauthorized external targets by default", () => {
    const plan = `
      env:
        contexts:
          - urls:
            - "https://unauthorized-remote-site.com/api"
    `;
    const result = validateSecurityPlanSafety(plan, { allowExternal: false });
    expect(result.safe).toBe(false);
    expect(result.blockedTargets).toContain("https://unauthorized-remote-site.com/api");
    expect(result.reason).toContain("Security Notice: Target or plan specifies non-local external host");
  });

  it("permits external targets when explicitly authorized", () => {
    const plan = `
      env:
        contexts:
          - urls:
            - "https://authorized-external.com/api"
    `;
    const result = validateSecurityPlanSafety(plan, { allowExternal: true });
    expect(result.safe).toBe(true);
  });

  it("blocks active scan jobs when allowActive is not provided", () => {
    const plan = `
      env:
        contexts:
          - urls:
            - "http://127.0.0.1:4173"
      jobs:
        - type: activeScan
    `;
    const result = validateSecurityPlanSafety(plan, { allowActive: false });
    expect(result.safe).toBe(false);
    expect(result.activeScanDetected).toBe(true);
    expect(result.reason).toContain("Active security scanning is declared in the scan plan");
  });

  it("permits active scan jobs when allowActive is true", () => {
    const plan = `
      env:
        contexts:
          - urls:
            - "http://127.0.0.1:4173"
      jobs:
        - type: activeScan
    `;
    const result = validateSecurityPlanSafety(plan, { allowActive: true });
    expect(result.safe).toBe(true);
    expect(result.activeScanDetected).toBe(true);
  });
});
