import { describe, expect, it } from "vitest";
import {
  detectK6Sync,
  getK6InstallInstructions,
  runK6DoctorChecks,
} from "./detector.js";

describe("k6 Detector", () => {
  it("detects k6 executable if installed in PATH", () => {
    const result = detectK6Sync();
    expect(typeof result.available).toBe("boolean");
    expect(result.command).toBe("k6");
    if (result.available) {
      expect(result.version).toBeDefined();
    }
  });

  it("handles non-existent custom binary path gracefully", () => {
    const result = detectK6Sync("/path/to/non-existent-k6-binary");
    expect(result.available).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  it("provides platform-specific installation instructions", () => {
    const instructions = getK6InstallInstructions();
    expect(instructions.platform).toBeDefined();
    expect(instructions.recommendedCommand).toBeDefined();
    expect(instructions.docsUrl).toContain("grafana.com");
  });

  it("runs doctor checks and returns structured results", async () => {
    const checks = await runK6DoctorChecks();
    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect(checks[0]?.name).toBe("k6 Executable");
    expect(["pass", "fail"]).toContain(checks[0]?.status);
  });
});
