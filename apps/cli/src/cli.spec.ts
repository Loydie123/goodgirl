import { describe, expect, it } from "vitest";
import { executeDoctorCommand } from "./commands/doctor.js";
import { executeReportCommand } from "./commands/report.js";
import { executeTraceCommand } from "./commands/trace.js";

describe("GoodGirl CLI Command Handlers", () => {
  it("doctor command runs and returns status code", async () => {
    const code = await executeDoctorCommand();
    expect(typeof code).toBe("number");
  });

  it("report command returns error code 1 when report file is missing", async () => {
    const code = await executeReportCommand({
      format: "json",
      config: "non-existent-config.ts",
    });
    expect(code).toBe(1);
  });

  it("trace command returns error code 1 when trace file is not found", async () => {
    const code = await executeTraceCommand("non-existent-trace-path.zip");
    expect(code).toBe(1);
  });
});
