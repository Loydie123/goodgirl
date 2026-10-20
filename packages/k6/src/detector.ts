import spawn from "cross-spawn";
import { existsSync } from "node:fs";
import type { DoctorCheckResult } from "@goodgirl/shared";

export interface K6DetectionResult {
  available: boolean;
  command: string;
  version?: string;
  error?: string;
}

export interface K6InstallInstructions {
  platform: string;
  recommendedCommand: string;
  alternativeCommands: string[];
  docsUrl: string;
}

export function getK6InstallInstructions(): K6InstallInstructions {
  const platform = process.platform;
  if (platform === "win32") {
    return {
      platform: "Windows",
      recommendedCommand: "winget install k6 --source winget",
      alternativeCommands: ["choco install k6", "scoop install k6"],
      docsUrl: "https://grafana.com/docs/k6/latest/set-up/install-k6/#windows",
    };
  }
  if (platform === "darwin") {
    return {
      platform: "macOS",
      recommendedCommand: "brew install k6",
      alternativeCommands: [],
      docsUrl: "https://grafana.com/docs/k6/latest/set-up/install-k6/#macos",
    };
  }
  return {
    platform: "Linux",
    recommendedCommand: "sudo apt-get install k6",
    alternativeCommands: [
      "sudo snap install k6",
      "sudo dnf install k6",
    ],
    docsUrl: "https://grafana.com/docs/k6/latest/set-up/install-k6/#linux",
  };
}

export function detectK6Sync(customBinaryPath?: string): K6DetectionResult {
  const candidate = customBinaryPath || "k6";

  if (customBinaryPath && !existsSync(customBinaryPath)) {
    return {
      available: false,
      command: candidate,
      error: `Configured k6 binary path does not exist: "${customBinaryPath}"`,
    };
  }

  try {
    const result = spawn.sync(candidate, ["version"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });

    if (result.error) {
      return {
        available: false,
        command: candidate,
        error: result.error.message,
      };
    }

    if (result.status === 0) {
      const output = (result.stdout || result.stderr || "").trim();
      const match = output.match(/k6\s+v?([0-9]+\.[0-9]+\.[0-9]+[^\s,]*)/i);
      const version = match ? match[1] : output.split("\n")[0]?.trim();
      return {
        available: true,
        command: candidate,
        version: version || "unknown",
      };
    }

    return {
      available: false,
      command: candidate,
      error: `k6 exited with non-zero status: ${result.status}`,
    };
  } catch (err) {
    return {
      available: false,
      command: candidate,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function detectK6(customBinaryPath?: string): Promise<K6DetectionResult> {
  return detectK6Sync(customBinaryPath);
}

export async function runK6DoctorChecks(
  customBinaryPath?: string,
): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const detection = await detectK6(customBinaryPath);
  const instructions = getK6InstallInstructions();

  if (detection.available) {
    checks.push({
      name: "k6 Executable",
      status: "pass",
      message: `Grafana k6 is installed (${detection.command})`,
      details: `Version: ${detection.version}`,
    });

    checks.push({
      name: "k6 Engine Capabilities",
      status: "pass",
      message: "Native scenarios, executors, metrics, and thresholds supported",
      details: "Compatible with constant-vus, ramping-vus, arrival-rate, and summary-export",
    });
  } else {
    checks.push({
      name: "k6 Executable",
      status: "fail",
      message: "Grafana k6 binary not found in PATH or specified location",
      details: `Install using: "${instructions.recommendedCommand}"\nDocumentation: ${instructions.docsUrl}`,
    });

    checks.push({
      name: "k6 Engine Capabilities",
      status: "warn",
      message: "Performance test execution unavailable until k6 is installed",
      details: "Playwright E2E and API tests remain fully operational",
    });
  }

  return checks;
}
