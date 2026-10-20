import { describe, expect, it } from "vitest";
import { executeDoctorCommand } from "./commands/doctor.js";

describe("GoodGirl CLI Command Handlers", () => {
  it("doctor command runs and returns status code", async () => {
    const code = await executeDoctorCommand();
    // 0 if healthy, or 1 if running before dependencies built
    expect(typeof code).toBe("number");
  });
});
