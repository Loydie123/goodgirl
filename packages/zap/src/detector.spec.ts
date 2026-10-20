import { describe, expect, it } from "vitest";
import {
  checkDockerStatus,
  detectZapEnvironmentSync,
  findLocalZapExecutable,
  getZapInstallInstructions,
  runZapDoctorChecks,
} from "./detector.js";

describe("OWASP ZAP Detector", () => {
  it("inspects Docker status safely", () => {
    const status = checkDockerStatus();
    expect(typeof status.installed).toBe("boolean");
    expect(typeof status.running).toBe("boolean");
  });

  it("handles non-existent custom ZAP executable path gracefully", () => {
    const found = findLocalZapExecutable("/non/existent/path/to/zap.sh");
    expect(found).toBeNull();
  });

  it("detects environment and reports engine status", () => {
    const env = detectZapEnvironmentSync();
    expect(["docker", "local", "none"]).toContain(env.engine);
    expect(typeof env.available).toBe("boolean");
    expect(typeof env.details).toBe("string");
  });

  it("provides platform-specific installation instructions", () => {
    const instructions = getZapInstallInstructions();
    expect(instructions.platform).toBeDefined();
    expect(instructions.instructions.length).toBeGreaterThan(0);
    expect(instructions.docsUrl).toContain("zaproxy.org");
  });

  it("runs doctor checks and returns structured check results", async () => {
    const checks = await runZapDoctorChecks();
    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect(["pass", "fail"]).toContain(checks[0]?.status);
    expect(checks[0]?.name).toBeDefined();
  });
});
