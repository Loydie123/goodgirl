import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";
import type { DoctorCheckResult } from "@goodgirl/shared";
import {
  DEFAULT_ZAP_BARE_DOCKER_IMAGE,
  DEFAULT_ZAP_DOCKER_IMAGE,
} from "@goodgirl/shared";
import type { ZapEnvironmentInfo } from "./types.js";

/**
 * Common standard installation paths for OWASP ZAP across platforms.
 */
const KNOWN_LOCAL_ZAP_PATHS = [
  // Windows
  "C:\\Program Files\\OWASP\\Zed Attack Proxy\\zap.bat",
  "C:\\Program Files (x86)\\OWASP\\Zed Attack Proxy\\zap.bat",
  // macOS
  "/Applications/OWASP ZAP.app/Contents/Java/zap.sh",
  "/Applications/ZAP.app/Contents/Java/zap.sh",
  "/opt/homebrew/bin/zap.sh",
  "/usr/local/bin/zap.sh",
  // Linux
  "/usr/share/zaproxy/zap.sh",
  "/usr/bin/zaproxy",
  "/snap/bin/zaproxy",
];

/**
 * Discovers a local ZAP executable in PATH or standard platform installation folders.
 */
export function findLocalZapExecutable(customPath?: string): string | null {
  if (customPath) {
    return existsSync(customPath) ? customPath : null;
  }

  // Check PATH first
  const isWindows = platform() === "win32";
  const cmd = isWindows ? "zap.bat" : "zap.sh";
  const whichCmd = isWindows ? "where" : "which";

  try {
    const probe = spawnSync(whichCmd, [cmd], {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (probe.status === 0 && probe.stdout) {
      const firstLine = probe.stdout.trim().split(/\r?\n/)[0]?.trim();
      if (firstLine && existsSync(firstLine)) {
        return firstLine;
      }
    }
  } catch {
    // Ignore PATH search failure
  }

  // Check known paths
  for (const known of KNOWN_LOCAL_ZAP_PATHS) {
    if (existsSync(known)) {
      return known;
    }
  }

  return null;
}

/**
 * Checks if Docker CLI is installed and the daemon is active.
 */
export function checkDockerStatus(): {
  installed: boolean;
  running: boolean;
  version?: string;
  osType?: string;
} {
  try {
    const versionCheck = spawnSync("docker", ["--version"], {
      encoding: "utf-8",
      timeout: 4000,
      stdio: ["ignore", "pipe", "ignore"],
    });

    if (versionCheck.status !== 0 || !versionCheck.stdout) {
      return { installed: false, running: false };
    }

    const versionStr = versionCheck.stdout.trim();

    // Check daemon responsiveness
    const infoCheck = spawnSync("docker", ["info", "--format", "{{.ServerVersion}} {{.OSType}}"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });

    const isRunning = infoCheck.status === 0 && Boolean(infoCheck.stdout?.trim());
    return {
      installed: true,
      running: isRunning,
      version: versionStr,
      osType: infoCheck.stdout?.trim().split(/\s+/)[1],
    };
  } catch {
    return { installed: false, running: false };
  }
}

/**
 * Checks if a specific Docker image is available locally.
 */
export function isDockerImageAvailable(imageName: string): boolean {
  try {
    const probe = spawnSync("docker", ["image", "inspect", imageName], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return probe.status === 0;
  } catch {
    return false;
  }
}

/**
 * Discovers the active OWASP ZAP execution engine (Docker vs Local).
 */
export function detectZapEnvironmentSync(
  customZapPath?: string,
  customDockerImage?: string,
): ZapEnvironmentInfo {
  const localZap = findLocalZapExecutable(customZapPath);
  const docker = checkDockerStatus();

  const targetImage = customDockerImage || DEFAULT_ZAP_DOCKER_IMAGE;
  const bareImage = DEFAULT_ZAP_BARE_DOCKER_IMAGE;

  let imageAvailable = false;
  let activeImage = targetImage;

  if (docker.running) {
    if (isDockerImageAvailable(targetImage)) {
      imageAvailable = true;
      activeImage = targetImage;
    } else if (isDockerImageAvailable(bareImage)) {
      imageAvailable = true;
      activeImage = bareImage;
    }
  }

  // 1. If local ZAP executable exists, prefer local or support direct execution
  if (localZap) {
    let localVersion: string | undefined;
    try {
      const vProbe = spawnSync(localZap, ["-version"], {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (vProbe.status === 0 && vProbe.stdout) {
        localVersion = vProbe.stdout.trim();
      }
    } catch {
      // Ignore version probe failure
    }

    return {
      available: true,
      engine: "local",
      version: localVersion,
      command: localZap,
      details: `Local OWASP ZAP installation found at: ${localZap}`,
      dockerAvailable: docker.installed,
      dockerRunning: docker.running,
      dockerImageAvailable: imageAvailable,
      localZapAvailable: true,
      localZapPath: localZap,
    };
  }

  if (docker.running && docker.osType !== "linux") {
    return { available: false, engine: "none", details: "ZAP Docker images require Linux containers. Switch Docker Desktop to Linux containers and verify: docker info --format '{{.OSType}}'.",
      dockerAvailable: true, dockerRunning: true, dockerImageAvailable: false, localZapAvailable: false };
  }

  // 2. If Docker daemon is running
  if (docker.running) {
    return {
      available: true,
      engine: "docker",
      image: activeImage,
      command: "docker",
      version: docker.version,
      details: imageAvailable
        ? `OWASP ZAP Docker engine ready (image: ${activeImage})`
        : `Docker is running; ZAP image (${activeImage}) will be pulled on first run`,
      dockerAvailable: docker.installed,
      dockerRunning: true,
      dockerImageAvailable: imageAvailable,
      localZapAvailable: false,
    };
  }

  // 3. Neither engine is ready
  return {
    available: false,
    engine: "none",
    details: docker.installed
      ? "Docker CLI is installed, but the Docker daemon is not running."
      : "Neither a local ZAP installation nor Docker was detected.",
    dockerAvailable: docker.installed,
    dockerRunning: false,
    dockerImageAvailable: false,
    localZapAvailable: false,
  };
}

/**
 * Returns OS-specific installation instructions for Docker and OWASP ZAP.
 */
export function getZapInstallInstructions(): {
  platform: string;
  recommendedEngine: string;
  instructions: string[];
  docsUrl: string;
} {
  const os = platform();

  if (os === "win32") {
    return {
      platform: "Windows",
      recommendedEngine: "Docker Desktop or winget",
      instructions: [
        "Option A (Recommended): Install Docker Desktop from https://www.docker.com/products/docker-desktop",
        "Option B (Standalone): winget install OWASP.ZAP",
        "Option C (Chocolatey): choco install zap",
      ],
      docsUrl: "https://www.zaproxy.org/docs/docker/",
    };
  }

  if (os === "darwin") {
    return {
      platform: "macOS",
      recommendedEngine: "Docker Desktop or Homebrew",
      instructions: [
        "Option A (Recommended): Install Docker Desktop from https://www.docker.com/products/docker-desktop",
        "Option B (Homebrew Cask): brew install --cask owasp-zap",
      ],
      docsUrl: "https://www.zaproxy.org/docs/docker/",
    };
  }

  return {
    platform: "Linux",
    recommendedEngine: "Docker",
    instructions: [
      "Option A (Recommended): Install Docker: sudo apt-get install docker.io && sudo systemctl start docker",
      "Option B (Direct): Download Linux package from https://www.zaproxy.org/download/",
    ],
    docsUrl: "https://www.zaproxy.org/docs/docker/",
  };
}

/**
 * Runs diagnostics checks for OWASP ZAP readiness.
 */
export async function runZapDoctorChecks(
  customZapPath?: string,
  customDockerImage?: string,
): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const envInfo = detectZapEnvironmentSync(customZapPath, customDockerImage);

  if (envInfo.localZapAvailable) {
    checks.push({
      name: "OWASP ZAP Local Executable",
      status: "pass",
      message: `Found local ZAP binary: ${envInfo.localZapPath}`,
      details: envInfo.version ? `Version: ${envInfo.version}` : undefined,
    });
  } else if (envInfo.dockerRunning && !envInfo.available) {
    checks.push({ name: "Docker Container Platform", status: "fail", message: envInfo.details });
  } else if (envInfo.dockerRunning) {
    checks.push({
      name: "Docker Execution Engine",
      status: "pass",
      message: `Docker daemon is active (${envInfo.version ?? "ready"})`,
      details: envInfo.dockerImageAvailable
        ? `ZAP Image: ${envInfo.image} (Cached locally)`
        : `ZAP Image: ${envInfo.image ?? DEFAULT_ZAP_DOCKER_IMAGE} (Will auto-pull upon scan)`,
    });
  } else if (envInfo.dockerAvailable) {
    checks.push({
      name: "Docker Execution Engine",
      status: "fail",
      message: "Docker CLI is installed, but the Docker daemon is not running.",
      details: "Please launch Docker Desktop or start the Docker daemon (sudo systemctl start docker).",
    });
  } else {
    const install = getZapInstallInstructions();
    checks.push({
      name: "OWASP ZAP Engine",
      status: "fail",
      message: "No OWASP ZAP execution engine found (Docker or local ZAP).",
      details: `Install recommendations for ${install.platform}:\n${install.instructions.map((i) => `  - ${i}`).join("\n")}\nDocs: ${install.docsUrl}`,
    });
  }

  checks.push({
    name: "ZAP Automation Framework Capability",
    status: envInfo.available ? "pass" : "fail",
    message: envInfo.available
      ? "Automation Framework (AF) plan execution supported via " +
        (envInfo.engine === "docker" ? "official ZAP container" : "local ZAP runtime")
      : "Automation Framework requires Docker or a local ZAP installation.",
  });

  return checks;
}
