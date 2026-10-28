import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runTests, resolvePlaywrightCli } from "./runner/orchestrator.js";
const dirs: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(done => server.close(() => done()))));
  dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true }));
});
function dir() { const cwd = mkdtempSync(join(tmpdir(), "goodgirl external QA ")); dirs.push(cwd); return cwd; }
async function fixture() {
  const cwd = dir();
  symlinkSync(resolve("node_modules"), join(cwd, "node_modules"), "junction");
  const server = createServer((_req, res) => { res.setHeader("content-type", "application/json"); res.end('{"healthy":true}'); }); servers.push(server);
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server address");
  mkdirSync(join(cwd, "tests/api"), { recursive: true });
  writeFileSync(join(cwd, "tests/api/health.spec.ts"), `import {test,expect} from '@playwright/test'; test('external contract',async({request})=>{expect(await (await request.get('/health')).json()).toEqual({healthy:true})});`);
  const baseURL = `http://127.0.0.1:${address.port}`;
  writeFileSync(join(cwd, "goodgirl.config.mjs"), `export default ${JSON.stringify({ baseURL, testDir: "tests", retries: 0 })}`);
  return { cwd, baseURL };
}
describe("external QA project integration", () => {
  it("runs the generated config outside the monorepo against an independent server", async () => {
    const { cwd } = await fixture(); const result = await runTests({ cwd, type: "api" });
    expect(result.subprocess.exitCode).toBe(0); expect(result.summary.passed).toBe(1);
    expect(existsSync(join(cwd, "goodgirl-results/results.json"))).toBe(true);
  }, 20000);
  it("preserves native reporters and supports list-only configs with fresh GoodGirl evidence", async () => {
    const { cwd, baseURL } = await fixture();
    writeFileSync(join(cwd, "playwright.config.ts"), `export default {testDir:'./tests',reporter:[['list'],['json',{outputFile:'native.json'}]],use:{baseURL:${JSON.stringify(baseURL)}}};`);
    const result = await runTests({ cwd, type: "all", workers: 2 });
    expect(result.subprocess.exitCode).toBe(0); expect(result.summary.passed).toBe(1);
    expect(existsSync(join(cwd, "native.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(cwd, "goodgirl-results/results.json"), "utf8")).config.workers).toBe(2);
  }, 20000);
  it("reports actionable missing dependencies, without falling back to GoodGirl's installation", () => {
    const cwd = dir();
    // Vitest patches require resolution; exercise Node's real resolver in a clean child.
    const probe = spawnSync(process.execPath, ["--input-type=module", "-e",
      `import {resolvePlaywrightCli} from ${JSON.stringify(pathToFileURL(resolve("dist/index.js")).href)}; try { resolvePlaywrightCli(${JSON.stringify(cwd)}); process.exit(2); } catch(e) { console.log(e.message); }`], { encoding: "utf8" });
    expect(probe.status).toBe(0); expect(probe.stdout).toContain("pnpm add -D @playwright/test");
  });
  it("selects the project's installation even when it differs from GoodGirl", () => {
    const cwd = dir(); const pkg = join(cwd, "node_modules/@playwright/test"); mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "package.json"), '{"name":"@playwright/test"}');
    expect(resolvePlaywrightCli(cwd).args).toEqual([join(realpathSync(pkg), "cli.js")]);
  });
});
