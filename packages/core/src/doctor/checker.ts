import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import type { DoctorCheckResult, DoctorReport } from "@goodgirl/shared";
import { loadGoodGirlConfig } from "../config/loader.js";

const require = createRequire(import.meta.url);

export async function runDoctorChecks(cwd: string = process.cwd()): Promise<DoctorReport> {
  const checks: DoctorCheckResult[] = [];

  // 1. Node.js Version Check (Requirement: >= 22.0.0)
  const nodeVersion = process.version;
  const major = Number.parseInt(nodeVersion.slice(1).split(".")[0] ?? "0", 10);
  if (major >= 22) {
    checks.push({
      name: "Node.js Runtime",
      status: "pass",
      message: `Running Node.js ${nodeVersion} (meets >= 22.0.0 requirement)`,
    });
  } else {
    checks.push({
      name: "Node.js Runtime",
      status: "fail",
      message: `Running Node.js ${nodeVersion}. GoodGirl requires Node.js >= 22.0.0`,
    });
  }

  // 2. Package Manager (pnpm)
  try {
    const isWin = process.platform === "win32";
    const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";
    const pnpmCheck = spawnSync(pnpmCmd, ["--version"], { encoding: "utf-8" });
    if (pnpmCheck.status === 0) {
      checks.push({
        name: "pnpm Package Manager",
        status: "pass",
        message: `pnpm v${pnpmCheck.stdout.trim()} is installed`,
      });
    } else {
      checks.push({
        name: "pnpm Package Manager",
        status: "warn",
        message: "pnpm was not found on PATH. Workspace tasks recommend pnpm.",
      });
    }
  } catch {
    checks.push({
      name: "pnpm Package Manager",
      status: "warn",
      message: "pnpm was not found on PATH. Workspace tasks recommend pnpm.",
    });
  }

  // 3. Operating System & Platform Info
  const platform = process.platform;
  const arch = process.arch;
  const platformName =
    platform === "win32"
      ? "Windows (PowerShell compatible)"
      : platform === "darwin"
        ? "macOS"
        : `Linux (${platform})`;

  checks.push({
    name: "Operating System",
    status: "pass",
    message: `${platformName} [${arch}]`,
    details: `Node Executable: ${process.execPath}`,
  });

  // 4. Playwright Framework & Browser Check
  try {
    require.resolve("@playwright/test/package.json");
    checks.push({
      name: "Playwright Test Package",
      status: "pass",
      message: "Playwright package is installed and resolvable",
    });
  } catch {
    checks.push({
      name: "Playwright Test Package",
      status: "fail",
      message: "Cannot resolve @playwright/test. Run `pnpm install`.",
    });
  }

  // 5. Configuration Validation
  try {
    const { config, configPath } = await loadGoodGirlConfig(cwd);
    if (configPath) {
      checks.push({
        name: "Configuration File",
        status: "pass",
        message: `Valid configuration found at: ${configPath}`,
        details: `Browser: ${config.browser}, BaseURL: ${config.baseURL}, Timeout: ${config.timeout}ms`,
      });
    } else {
      checks.push({
        name: "Configuration File",
        status: "warn",
        message: "No goodgirl.config.ts found in current directory (using defaults). Run `goodgirl init` to scaffold one.",
      });
    }
  } catch (err) {
    checks.push({
      name: "Configuration File",
      status: "fail",
      message: `Invalid configuration: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 6. Output Directory Writable Check
  const testOutputDir = resolve(cwd, ".goodgirl-doctor-probe");
  try {
    if (!existsSync(testOutputDir)) {
      mkdirSync(testOutputDir, { recursive: true });
    }
    const testFile = join(testOutputDir, "probe.tmp");
    writeFileSync(testFile, "probe", "utf-8");
    unlinkSync(testFile);
    rmdirSync(testOutputDir);
    checks.push({
      name: "Workspace File System Permissions",
      status: "pass",
      message: "Workspace directory is writable for test results and reports",
    });
  } catch (err) {
    checks.push({
      name: "Workspace File System Permissions",
      status: "fail",
      message: `Cannot write to workspace: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const healthy = !checks.some((c) => c.status === "fail");

  return {
    checks,
    healthy,
  };
}
