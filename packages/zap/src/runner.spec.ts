import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const control = vi.hoisted(() => ({ report: "missing", code: 0, wait: false }));
vi.mock("./detector.js", () => ({
  detectZapEnvironmentSync: () => ({ available: true, engine: "local", command: "test-zap", details: "test double" }),
  getZapInstallInstructions: () => ({ instructions: [] }),
}));
vi.mock("cross-spawn", () => ({ default: Object.assign((_command: string, args: string[]) => {
  const events = new EventEmitter();
  const proc = Object.assign(events, { stdout: new EventEmitter(), stderr: new EventEmitter(),
    exitCode: null as number | null, signalCode: null as string | null,
    kill(sig: string) { this.signalCode = sig; queueMicrotask(() => events.emit("close", null, sig)); return true; } });
  queueMicrotask(() => {
    const plan = parse(readFileSync(args[2]!, "utf8"));
    const dir = plan.jobs.find((j: { type: string }) => j.type === "report")?.parameters.reportDir ?? dirname(args[2]!);
    if (control.report !== "missing") writeFileSync(join(dir, "zap-report.json"), control.report === "malformed" ? '{}' : JSON.stringify({ site: [{ alerts: [{ pluginid: "1", alert: "Low finding", riskcode: "1", confidence: "2" }] }] }));
    if (!control.wait) { proc.exitCode = control.code; proc.emit("close", control.code, null); }
  });
  return proc;
}, { sync: vi.fn() }) }));
import { runZapAutomation } from "./runner.js";
const dirs: string[] = [];
function workspace() { const dir = mkdtempSync(join(tmpdir(), "goodgirl zap regression ")); dirs.push(dir); return dir; }
afterEach(() => { dirs.forEach(d => rmSync(d, { recursive: true, force: true })); dirs.length = 0; control.report = "missing"; control.code = 0; control.wait = false; });

describe("ZAP current-run evidence", () => {
  it("rejects valid no-report plans and never attaches previous HTML/JSON", async () => {
    const cwd = workspace(); mkdirSync(join(cwd, "goodgirl-results"));
    writeFileSync(join(cwd, "goodgirl-results/zap-report.html"), "old finding");
    writeFileSync(join(cwd, "goodgirl-results/zap-report.json"), '{"site":[]}');
    writeFileSync(join(cwd, "no-report.yaml"), "jobs: [{type: passiveScan-config}]\n");
    const result = await runZapAutomation({ cwd, planPath: "no-report.yaml" });
    expect(result.success).toBe(false); expect(result.status).toBe("missing-report");
    expect(result.exitCode).toBe(0); // Keep native status distinct from assessment success.
    expect(result.riskSummary).toBeNull(); expect(result.reportPathHtml).toBeUndefined();
    expect(result.reportPathJson).toBeUndefined(); expect(result.failureReason).toContain("current-run");
  });
  it("rejects malformed reports", async () => {
    control.report = "malformed";
    expect((await runZapAutomation({ cwd: workspace() })).status).toBe("malformed-report");
  });
  it("accepts native warning exit 2 only with valid report and passing policy", async () => {
    control.report = "valid"; control.code = 2;
    const result = await runZapAutomation({ cwd: workspace(), failOnRisk: "High" });
    expect(result.success).toBe(true); expect(result.exitCode).toBe(2); expect(result.riskSummary?.low).toBe(1);
  });
  it("retains actual findings on policy failure", async () => {
    control.report = "valid";
    const result = await runZapAutomation({ cwd: workspace(), failOnRisk: "Low" });
    expect(result.success).toBe(false); expect(result.status).toBe("risk-failure"); expect(result.alerts[0]?.risk).toBe("Low");
  });
  it("rejects engine errors even with a valid report", async () => {
    control.report = "valid"; control.code = 1;
    expect((await runZapAutomation({ cwd: workspace() })).status).toBe("engine-failure");
  });
  it("never converts timeout termination into successful exit zero", async () => {
    control.wait = true;
    const result = await runZapAutomation({ cwd: workspace(), timeoutSeconds: 0.01 });
    expect(result.success).toBe(false); expect(result.status).toBe("incomplete"); expect(result.exitCode).not.toBe(0);
    expect(result.failureReason).toContain("timed out");
  });
  it("allocates different ownership directories for repeated runs", async () => {
    const cwd = workspace(); control.report = "valid";
    const first = await runZapAutomation({ cwd }); control.report = "missing";
    const second = await runZapAutomation({ cwd });
    expect(second.runDir).not.toBe(first.runDir); expect(second.success).toBe(false); expect(second.reportPathJson).toBeUndefined();
  });
});
