import { describe, expect, it, vi } from "vitest";
vi.mock("node:child_process", () => ({ spawnSync: (command: string, args: string[]) => {
  if (command !== "docker") return { status: 1, stdout: "" };
  if (args[0] === "--version") return { status: 0, stdout: "Docker 29" };
  if (args[0] === "info") return { status: 0, stdout: "29 windows" };
  return { status: 1, stdout: "" };
} }));
vi.mock("node:fs", () => ({ existsSync: () => false }));
import { detectZapEnvironmentSync, runZapDoctorChecks } from "./detector.js";
describe("Windows Docker platform diagnostic", () => {
  it("rejects a Windows-container daemon before attempting the Linux ZAP image", async () => {
    const engine = detectZapEnvironmentSync();
    expect(engine.available).toBe(false); expect(engine.details).toContain("Linux containers");
    const checks = await runZapDoctorChecks();
    expect(checks[0]?.status).toBe("fail"); expect(checks[0]?.message).toContain("Linux containers");
  });
});
