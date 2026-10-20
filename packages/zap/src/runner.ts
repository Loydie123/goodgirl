import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { platform } from "node:os";
import spawn from "cross-spawn";
import {
  DEFAULT_RESULTS_DIR,
  DEFAULT_SECURITY_FAIL_ON_RISK,
  DEFAULT_SECURITY_TIMEOUT_SECONDS,
  getSecurityResultsPaths,
} from "@goodgirl/shared";
import type {
  SecurityRunOptions,
  SecurityRunSummary,
} from "@goodgirl/shared";
import { detectZapEnvironmentSync, getZapInstallInstructions } from "./detector.js";
import { parseZapJsonReport } from "./parser.js";
import { buildApiPlan, buildBaselinePlan } from "./plan-builder.js";
import { validateSecurityPlanSafety } from "./safety.js";

/**
 * Normalizes host targets inside a YAML plan for container networking.
 * On macOS and Windows Docker, maps 127.0.0.1 and localhost to host.docker.internal.
 */
export function adjustPlanForDockerNetworking(planContent: string): string {
  const os = platform();
  if (os === "darwin" || os === "win32") {
    return planContent
      .replace(/http:\/\/127\.0\.0\.1:/g, "http://host.docker.internal:")
      .replace(/https:\/\/127\.0\.0\.1:/g, "https://host.docker.internal:")
      .replace(/http:\/\/localhost:/g, "http://host.docker.internal:")
      .replace(/https:\/\/localhost:/g, "https://host.docker.internal:");
  }
  return planContent;
}

/**
 * Executes an OWASP ZAP Automation Framework security scan.
 */
export async function runZapAutomation(
  options: SecurityRunOptions = {},
): Promise<SecurityRunSummary> {
  const startTime = Date.now();
  const cwd = options.cwd ?? process.cwd();
  const resultsDir = resolve(cwd, options.reportDir ?? DEFAULT_RESULTS_DIR);
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  try {
    chmodSync(resultsDir, 0o777);
  } catch {
    // Ignore permissions errors on platforms without POSIX chmod
  }

  const paths = getSecurityResultsPaths(cwd, options.reportDir);

  // Clean stale reports before run
  if (existsSync(paths.securityJsonReportPath)) {
    try {
      unlinkSync(paths.securityJsonReportPath);
    } catch {
      // Ignore
    }
  }

  // 1. Detect engine
  const envInfo = detectZapEnvironmentSync(options.zapPath, options.dockerImage);
  if (!envInfo.available || envInfo.engine === "none") {
    const install = getZapInstallInstructions();
    const errorMsg =
      `OWASP ZAP Engine Unavailable:\n` +
      `Neither a local ZAP installation nor Docker daemon was found.\n\n` +
      `Recommended setup for ${install.platform}:\n` +
      install.instructions.map((i) => `  - ${i}`).join("\n") +
      `\nDocumentation: ${install.docsUrl}`;
    throw new Error(errorMsg);
  }

  // 2. Resolve or generate Automation Framework plan
  let planFilePath = "";
  let isTempPlan = false;
  let rawPlanContent = "";

  if (options.planPath) {
    const candidate = isAbsolute(options.planPath) ? options.planPath : resolve(cwd, options.planPath);
    if (!existsSync(candidate)) {
      throw new Error(`ZAP Automation Framework plan not found at: "${candidate}"`);
    }
    planFilePath = candidate;
    rawPlanContent = readFileSync(planFilePath, "utf-8");
  } else if (options.mode === "api" || options.apiSpec) {
    const spec = options.apiSpec ?? "";
    if (!spec) {
      throw new Error("An OpenAPI specification path or URL must be provided for API security testing.");
    }
    rawPlanContent = buildApiPlan({
      apiFileOrUrl: spec,
      targetUrl: options.target,
      reportDir: "/zap/wrk/goodgirl-results",
      reportFile: "zap-report",
    });
    planFilePath = join(resultsDir, ".goodgirl-zap-api-plan.yaml");
    writeFileSync(planFilePath, rawPlanContent, "utf-8");
    isTempPlan = true;
  } else {
    // Default: Baseline passive scan
    const target = options.target ?? "http://127.0.0.1:4173";
    rawPlanContent = buildBaselinePlan({
      targetUrl: target,
      reportDir: "/zap/wrk/goodgirl-results",
      reportFile: "zap-report",
    });
    planFilePath = join(resultsDir, ".goodgirl-zap-baseline-plan.yaml");
    writeFileSync(planFilePath, rawPlanContent, "utf-8");
    isTempPlan = true;
  }

  // 3. Safety and Target Verification
  const safety = validateSecurityPlanSafety(rawPlanContent, {
    allowedTargets: options.target ? [options.target] : [],
    allowExternal: options.allowExternal,
    allowActive: options.activeScan,
  });

  if (!safety.safe) {
    if (isTempPlan && existsSync(planFilePath)) {
      try {
        unlinkSync(planFilePath);
      } catch {
        // Ignore
      }
    }
    throw new Error(safety.reason ?? "Security Guardrail Violation");
  }

  // 4. Prepare execution arguments based on engine
  let execCommand = "";
  let execArgs: string[] = [];
  const timeoutMs = (options.timeoutSeconds ?? DEFAULT_SECURITY_TIMEOUT_SECONDS) * 1000;

  if (envInfo.engine === "docker") {
    // If executing in Docker on Mac/Windows, adjust local addresses and save docker-ready plan
    const dockerPlanContent = adjustPlanForDockerNetworking(rawPlanContent);
    const dockerPlanFile = join(cwd, ".goodgirl-docker-zap-plan.yaml");
    writeFileSync(dockerPlanFile, dockerPlanContent, "utf-8");
    try {
      chmodSync(dockerPlanFile, 0o666);
    } catch {
      // Ignore permissions errors
    }

    // Relative path inside container mount /zap/wrk
    const relPlanPath = relative(cwd, dockerPlanFile).replace(/\\/g, "/");

    execCommand = "docker";
    execArgs = [
      "run",
      "--rm",
      "-u",
      "0:0",
      "-w",
      "/zap/wrk",
      "-v",
      `${cwd}:/zap/wrk/:rw`,
    ];

    const os = platform();
    if (os === "linux") {
      execArgs.push("--network=host");
    } else {
      execArgs.push("--add-host=host.docker.internal:host-gateway");
    }

    // Pass environment variables to Docker if provided
    if (options.env) {
      for (const [k, v] of Object.entries(options.env)) {
        execArgs.push("-e", `${k}=${v}`);
      }
    }

    execArgs.push(
      envInfo.image ?? "ghcr.io/zaproxy/zaproxy:stable",
      "zap.sh",
      "-cmd",
      "-autorun",
      `/zap/wrk/${relPlanPath}`,
    );

    if (options.passthroughArgs && options.passthroughArgs.length > 0) {
      execArgs.push(...options.passthroughArgs);
    }
  } else {
    // Local ZAP binary execution
    execCommand = envInfo.command ?? "zap.sh";
    execArgs = ["-cmd", "-autorun", planFilePath];

    if (options.passthroughArgs && options.passthroughArgs.length > 0) {
      execArgs.push(...options.passthroughArgs);
    }
  }

  // 5. Execute process with live logging and timeout
  let exitCode = 0;
  let executionError: Error | null = null;
  let stdoutBuffer = "";
  let stderrBuffer = "";

  try {
    const proc = spawn(execCommand, execArgs, {
      cwd,
      stdio: options.raw ? "inherit" : ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
    });

    if (!options.raw && proc.stdout) {
      proc.stdout.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString("utf-8");
      });
    }

    if (!options.raw && proc.stderr) {
      proc.stderr.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf-8");
      });
    }

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
      }, 3000);
    }, timeoutMs);

    exitCode = await new Promise<number>((resolveExit, rejectExit) => {
      proc.on("close", (code) => {
        clearTimeout(timer);
        resolveExit(code ?? 0);
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        rejectExit(err);
      });
    });
  } catch (err) {
    executionError = err instanceof Error ? err : new Error(String(err));
    exitCode = 1;
  }

  // Clean up temporary plans
  if (isTempPlan && existsSync(planFilePath)) {
    try {
      unlinkSync(planFilePath);
    } catch {
      // Ignore
    }
  }

  const dockerTemp = join(cwd, ".goodgirl-docker-zap-plan.yaml");
  if (existsSync(dockerTemp)) {
    try {
      unlinkSync(dockerTemp);
    } catch {
      // Ignore
    }
  }

  const durationMs = Date.now() - startTime;

  // 6. Parse results
  const reportJsonCandidate = paths.securityJsonReportPath;
  const reportGenerated = existsSync(reportJsonCandidate);

  // Ensure output files are accessible cross-platform
  try {
    if (reportGenerated) {
      chmodSync(reportJsonCandidate, 0o666);
    }
    if (existsSync(paths.securityHtmlReportPath)) {
      chmodSync(paths.securityHtmlReportPath, 0o666);
    }
  } catch {
    // Ignore permissions errors
  }

  let alerts: SecurityRunSummary["alerts"] = [];
  let riskSummary: SecurityRunSummary["riskSummary"] = {
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
    total: 0,
  };
  let thresholdPassed = true;

  if (reportGenerated) {
    const parsed = parseZapJsonReport(reportJsonCandidate, {
      failOnRisk: options.failOnRisk ?? DEFAULT_SECURITY_FAIL_ON_RISK,
    });
    alerts = parsed.alerts;
    riskSummary = parsed.riskSummary;
    thresholdPassed = parsed.thresholdPassed;
  } else if (!executionError && exitCode === 0) {
    // If no alerts file was written, ZAP completed cleanly with 0 alerts
    thresholdPassed = true;
  } else {
    thresholdPassed = false;
  }

  // ZAP AF exit code 0 = clean, exit code 2 = completed with warnings/alerts
  const zapCompleted = (exitCode === 0 || exitCode === 2) && reportGenerated;
  const success = (zapCompleted || exitCode === 0) && thresholdPassed && !executionError && (reportGenerated || exitCode === 0);

  const summary: SecurityRunSummary = {
    target: options.target,
    planPath: options.planPath ?? planFilePath,
    durationMs,
    timestamp: new Date().toISOString(),
    exitCode,
    success,
    thresholdPassed,
    riskSummary,
    alerts,
    reportPathJson: reportGenerated ? paths.securityJsonReportPath : undefined,
    reportPathHtml: existsSync(paths.securityHtmlReportPath) ? paths.securityHtmlReportPath : undefined,
    engine: {
      type: envInfo.engine,
      version: envInfo.version,
      image: envInfo.image,
      command: envInfo.command,
      details: envInfo.details,
    },
    failureReason: executionError
      ? executionError.message
      : !reportGenerated && exitCode !== 0
        ? `ZAP execution failed with exit code ${exitCode} and no report was generated${stderrBuffer ? ": " + stderrBuffer.trim() : stdoutBuffer ? ": " + stdoutBuffer.trim() : ""}`
        : !thresholdPassed
          ? `Security risk threshold breached (Risk level "${options.failOnRisk ?? DEFAULT_SECURITY_FAIL_ON_RISK}" or higher found)`
          : undefined,
  };

  // Persist summary
  writeFileSync(paths.securityResultsJsonPath, JSON.stringify(summary, null, 2), "utf-8");
  try {
    chmodSync(paths.securityResultsJsonPath, 0o666);
  } catch {
    // Ignore permissions errors
  }

  return summary;
}
