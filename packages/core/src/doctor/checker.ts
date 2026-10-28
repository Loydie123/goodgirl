import spawn from "cross-spawn";
const spawnSync = spawn.sync;
import { existsSync, mkdirSync, rmdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import type { DoctorCheckResult, DoctorReport } from "@goodgirl/shared";
import { detectK6Sync, getK6InstallInstructions } from "@goodgirl/k6";
import { detectZapEnvironmentSync, runZapDoctorChecks } from "@goodgirl/zap";
import { loadGoodGirlConfig } from "../config/loader.js";

const require = createRequire(import.meta.url);

export async function runDoctorChecks(
  cwd: string = process.cwd(),
  customConfigPath?: string,
): Promise<DoctorReport> {
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

    // Detect browser binaries in standard cache directories
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const localAppData = process.env.LOCALAPPDATA || "";
    const candidateDirs = [
      join(localAppData, "ms-playwright"),
      join(home, "Library", "Caches", "ms-playwright"),
      join(home, ".cache", "ms-playwright"),
    ];

    let cacheDir: string | undefined;
    for (const d of candidateDirs) {
      if (d && existsSync(d)) {
        cacheDir = d;
        break;
      }
    }

    let chromium = false;
    let firefox = false;
    let webkit = false;

    if (cacheDir) {
      try {
        const { readdirSync } = await import("node:fs");
        const entries = readdirSync(cacheDir);
        chromium = entries.some((e) => e.startsWith("chromium"));
        firefox = entries.some((e) => e.startsWith("firefox"));
        webkit = entries.some((e) => e.startsWith("webkit"));
      } catch {
        // Continue
      }
    }

    const installed: string[] = [];
    if (chromium) installed.push("Chromium");
    if (firefox) installed.push("Firefox");
    if (webkit) installed.push("WebKit");

    if (installed.length > 0) {
      checks.push({
        name: "Playwright Browser Engines",
        status: "pass",
        message: `Installed browsers: ${installed.join(", ")}`,
        details:
          installed.length < 3
            ? `To install additional browsers for multi-browser testing, run: pnpm exec playwright install ${[
                !chromium ? "chromium" : null,
                !firefox ? "firefox" : null,
                !webkit ? "webkit" : null,
              ]
                .filter(Boolean)
                .join(" ")}`
            : undefined,
      });
    } else {
      checks.push({
        name: "Playwright Browser Engines",
        status: "warn",
        message: "No Playwright browser binaries detected in cache.",
        details: "Run `pnpm exec playwright install chromium` to install browser binaries.",
      });
    }
  } catch {
    checks.push({
      name: "Playwright Test Package",
      status: "fail",
      message: "Cannot resolve @playwright/test. Run `pnpm install`.",
    });
  }

  // 5. Configuration Validation
  try {
    const { config, configPath } = await loadGoodGirlConfig(cwd, customConfigPath);
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

  // 7. Optional k6 Load Testing Engine Status
  try {
    const { config } = await loadGoodGirlConfig(cwd, customConfigPath);
    const k6Detection = detectK6Sync(config.k6?.binaryPath);
    if (k6Detection.available) {
      checks.push({
        name: "Grafana k6 Engine (Optional)",
        status: "pass",
        message: `k6 is available (${k6Detection.version})`,
      });
    } else {
      checks.push({
        name: "Grafana k6 Engine (Optional)",
        status: "warn",
        message: "k6 executable not detected. Install k6 to unlock performance testing.",
        details: "Run `goodgirl load doctor` for installation instructions.",
      });
    }

    // 8. Optional OWASP ZAP Security Testing Engine Status
    const zapEnv = detectZapEnvironmentSync(config.security?.zapPath, config.security?.dockerImage);
    if (zapEnv.available) {
      checks.push({
        name: "OWASP ZAP Engine (Optional)",
        status: "pass",
        message:
          zapEnv.engine === "docker"
            ? `Docker engine available (${zapEnv.image ?? "ZAP container"})`
            : `Local ZAP available (${zapEnv.version ?? "binary"})`,
      });
    } else {
      checks.push({
        name: "OWASP ZAP Engine (Optional)",
        status: "warn",
        message: "Neither Docker nor local ZAP was detected. Required for security testing.",
        details: "Run `goodgirl security doctor` for installation instructions.",
      });
    }
  } catch {
    // Continue
  }

  const healthy = !checks.some((c) => c.status === "fail");

  return {
    checks,
    healthy,
  };
}

/**
 * Runs specialized diagnostics for the Grafana k6 performance testing environment.
 */
export async function runLoadDoctorChecks(
  cwd: string = process.cwd(),
  customConfigPath?: string,
): Promise<DoctorReport> {
  const checks: DoctorCheckResult[] = [];

  // 1. Node.js Version Check
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

  // 2. Operating System
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
  });

  // 3. Load Configuration
  let binaryPath: string | undefined;
  let allowedTargets: string[] | undefined;
  try {
    const { config, configPath } = await loadGoodGirlConfig(cwd, customConfigPath);
    binaryPath = config.k6?.binaryPath;
    allowedTargets = config.k6?.allowedTargets;
    if (configPath) {
      checks.push({
        name: "Configuration File",
        status: "pass",
        message: `Found valid configuration: ${configPath}`,
        details: `k6 targets allowlist: ${allowedTargets ? allowedTargets.join(", ") : "default (localhost only)"}`,
      });
    } else {
      checks.push({
        name: "Configuration File",
        status: "pass",
        message: "Using default GoodGirl configuration (localhost allowlist enforced)",
      });
    }
  } catch (err) {
    checks.push({
      name: "Configuration File",
      status: "fail",
      message: `Configuration error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 4. k6 Executable and Version Check
  const k6Detection = detectK6Sync(binaryPath);
  const installInstructions = getK6InstallInstructions();

  if (k6Detection.available) {
    checks.push({
      name: "k6 Binary Executable",
      status: "pass",
      message: `Grafana k6 detected: ${k6Detection.command} (${k6Detection.version})`,
    });

    checks.push({
      name: "k6 Execution Capabilities",
      status: "pass",
      message: "Native scenarios, virtual users, ramping stages, and thresholds available",
      details: "Support: constant-vus, ramping-vus, arrival-rate, summary-export",
    });
  } else {
    checks.push({
      name: "k6 Binary Executable",
      status: "fail",
      message: `Grafana k6 executable not found in PATH${binaryPath ? ` or at configured path "${binaryPath}"` : ""}`,
      details:
        `To install k6 on ${installInstructions.platform}:\n` +
        `  Run: ${installInstructions.recommendedCommand}\n` +
        (installInstructions.alternativeCommands.length > 0
          ? `  Alternative: ${installInstructions.alternativeCommands.join(", ")}\n`
          : "") +
        `  Documentation: ${installInstructions.docsUrl}`,
    });

    checks.push({
      name: "k6 Execution Capabilities",
      status: "fail",
      message: "k6 runner cannot execute performance tests until binary is installed",
    });
  }

  // 5. Output Directory Writable Check
  const testOutputDir = resolve(cwd, ".goodgirl-k6-doctor-probe");
  try {
    if (!existsSync(testOutputDir)) {
      mkdirSync(testOutputDir, { recursive: true });
    }
    const testFile = join(testOutputDir, "probe.tmp");
    writeFileSync(testFile, "probe", "utf-8");
    unlinkSync(testFile);
    rmdirSync(testOutputDir);
    checks.push({
      name: "Results Directory Permissions",
      status: "pass",
      message: "Workspace directory is writable for k6 summary reports and artifacts",
    });
  } catch (err) {
    checks.push({
      name: "Results Directory Permissions",
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

/**
 * Runs specialized diagnostics for the OWASP ZAP security testing environment.
 */
export async function runSecurityDoctorChecks(
  cwd: string = process.cwd(),
  customConfigPath?: string,
): Promise<DoctorReport> {
  const checks: DoctorCheckResult[] = [];

  // 1. Node Runtime Check
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

  // 2. Operating System
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
  });

  // 3. Security Configuration
  let zapPath: string | undefined;
  let dockerImage: string | undefined;
  let allowedTargets: string[] | undefined;
  try {
    const { config, configPath } = await loadGoodGirlConfig(cwd, customConfigPath);
    zapPath = config.security?.zapPath;
    dockerImage = config.security?.dockerImage;
    allowedTargets = config.security?.allowedTargets;
    if (configPath) {
      checks.push({
        name: "Configuration File",
        status: "pass",
        message: `Found valid configuration: ${configPath}`,
        details: `Security targets allowlist: ${allowedTargets && allowedTargets.length > 0 ? allowedTargets.join(", ") : "default (localhost only)"}`,
      });
    } else {
      checks.push({
        name: "Configuration File",
        status: "pass",
        message: "Using default GoodGirl configuration (localhost allowlist enforced)",
      });
    }
  } catch (err) {
    checks.push({
      name: "Configuration File",
      status: "fail",
      message: `Configuration error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 4. Run ZAP specific checks (Docker / Local binary / Automation Framework)
  const zapChecks = await runZapDoctorChecks(zapPath, dockerImage);
  checks.push(...zapChecks);

  // 5. Output Directory Writable Check
  const testOutputDir = resolve(cwd, ".goodgirl-zap-doctor-probe");
  try {
    if (!existsSync(testOutputDir)) {
      mkdirSync(testOutputDir, { recursive: true });
    }
    const testFile = join(testOutputDir, "probe.tmp");
    writeFileSync(testFile, "probe", "utf-8");
    unlinkSync(testFile);
    rmdirSync(testOutputDir);
    checks.push({
      name: "Results Directory Permissions",
      status: "pass",
      message: "Workspace directory is writable for ZAP reports and security artifacts",
    });
  } catch (err) {
    checks.push({
      name: "Results Directory Permissions",
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

