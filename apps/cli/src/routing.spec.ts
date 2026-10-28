import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const handlers = vi.hoisted(() => ({ test: vi.fn(async () => 0), load: vi.fn(async () => 0), security: vi.fn(async () => 0) }));
vi.mock("./commands/test.js", () => ({ executeTestCommand: handlers.test }));
vi.mock("./commands/load.js", () => ({ executeLoadRunCommand: handlers.load, executeLoadDoctorCommand: vi.fn() }));
vi.mock("./commands/security.js", () => ({ executeSecurityRunCommand: handlers.security, executeSecurityApiCommand: handlers.security,
  executeSecurityBaselineCommand: handlers.security, executeSecurityDoctorCommand: vi.fn(), executeSecurityReportCommand: vi.fn() }));
const argv = process.argv;
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.spyOn(process, "exit").mockImplementation(() => undefined as never); });
afterEach(() => { process.argv = argv; vi.restoreAllMocks(); });
async function parse(args: string[]) {
  process.argv = [process.execPath, "goodgirl", ...args];
  const { program } = await import("./program.js");
  for (const cmd of [program, ...program.commands, ...program.commands.flatMap(c => c.commands)]) cmd.exitOverride();
  await program.parseAsync(process.argv);
}
describe("Commander routing regressions", () => {
  it("forwards nested test options including quoted Windows paths", async () => {
    await parse(["test", "all", "--workers", "50%", "--retries", "2", "--grep", "login flow", "--config", "C:\\QA Projects\\shop\\goodgirl.config.ts"]);
    expect(handlers.test).toHaveBeenCalledWith("all", [], expect.objectContaining({ workers: "50%", retries: "2", grep: "login flow", config: "C:\\QA Projects\\shop\\goodgirl.config.ts" }));
  });
  it("nested explicit values beat explicit parent values and defaults", async () => {
    await parse(["test", "--workers", "1", "all", "--workers", "2"]);
    expect(handlers.test).toHaveBeenCalledWith("all", [], expect.objectContaining({ workers: "2" }));
  });
  it("forwards k6 target environment and exports", async () => {
    await parse(["load", "run", "script with spaces.js", "--env", "TARGET_URL=http://localhost:4387", "--vus", "2", "--json-report", "reports with spaces/result.json"]);
    expect(handlers.load).toHaveBeenCalledWith("script with spaces.js", expect.objectContaining({ vus: "2", env: ["TARGET_URL=http://localhost:4387"], jsonReport: "reports with spaces/result.json" }));
  });
  it("preserves raw native arguments without treating them as test files", async () => {
    await parse(["test", "all", "--", "--workers=1", "--output=C:\\QA Projects\\results"]);
    expect(handlers.test).toHaveBeenCalledWith("all", [], expect.objectContaining({ passthroughArgs: ["--workers=1", "--output=C:\\QA Projects\\results"] }));
  });
  it("forwards native ZAP arguments", async () => {
    await parse(["security", "run", "passive.yaml", "--", "-config", "api.disablekey=true"]);
    expect(handlers.security).toHaveBeenCalledWith("passive.yaml", expect.objectContaining({ passthroughArgs: ["-config", "api.disablekey=true"] }));
  });
  it.each([["test", "all", "--unknown"], ["test", "all", "--workers"], ["test", "all", "--workers", "2oops"],
    ["load", "run", "test.js", "--vus", "NaN"], ["security", "baseline", "--fail-on", "Hgh"]])("rejects malformed/unsupported options: %j", async (...args) => {
    await expect(parse(args)).rejects.toThrow(); expect(handlers.test).not.toHaveBeenCalled(); expect(handlers.load).not.toHaveBeenCalled(); expect(handlers.security).not.toHaveBeenCalled();
  });
});
