import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { platform } from "node:os";
import spawn from "cross-spawn";
import { parse, stringify } from "yaml";
import { DEFAULT_RESULTS_DIR, DEFAULT_SECURITY_FAIL_ON_RISK, DEFAULT_SECURITY_TIMEOUT_SECONDS, getSecurityResultsPaths } from "@goodgirl/shared";
import type { SecurityRunOptions, SecurityRunSummary } from "@goodgirl/shared";
import { detectZapEnvironmentSync, getZapInstallInstructions } from "./detector.js";
import { parseZapJsonReport } from "./parser.js";
import { buildApiPlan, buildBaselinePlan } from "./plan-builder.js";
import { validateSecurityPlanSafety } from "./safety.js";
import type { ZapAutomationPlan } from "./types.js";

export function adjustPlanForDockerNetworking(content: string): string {
  return platform() === "darwin" || platform() === "win32"
    ? content.replace(/(https?:\/\/)(127\.0\.0\.1|localhost)(?=[:/]|$)/g, "$1host.docker.internal")
    : content;
}

/** Each invocation owns a fresh directory, including the plan and all report jobs. */
export async function runZapAutomation(options: SecurityRunOptions = {}): Promise<SecurityRunSummary> {
  const startTime = Date.now();
  const cwd = resolve(options.cwd ?? process.cwd());
  const resultsDir = resolve(cwd, options.reportDir ?? DEFAULT_RESULTS_DIR);
  const paths = getSecurityResultsPaths(cwd, options.reportDir);
  const runId = randomUUID();
  const runDir = join(resultsDir, "zap-runs", runId);
  mkdirSync(runDir, { recursive: true });
  // Invalidate the previous latest result even when preparation fails.
  writeFileSync(paths.securityResultsJsonPath, JSON.stringify({ success: false, status: "incomplete", runDir,
    failureReason: "Scan preparation has not completed; no current report is available." }, null, 2));
  if (options.jsonReportPath) {
    const destination = resolve(cwd, options.jsonReportPath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(paths.securityResultsJsonPath, destination);
  }
  if (options.htmlReportPath && existsSync(resolve(cwd, options.htmlReportPath))) unlinkSync(resolve(cwd, options.htmlReportPath));
  const engine = detectZapEnvironmentSync(options.zapPath, options.dockerImage);
  if (!engine.available || engine.engine === "none") {
    throw new Error(`OWASP ZAP Engine Unavailable: ${engine.details}\n${getZapInstallInstructions().instructions.join("\n")}`);
  }
  const docker = engine.engine === "docker";
  const reportDir = docker ? "/zap/reports" : runDir;
  let content: string;
  if (options.planPath) {
    const path = resolve(cwd, options.planPath);
    if (!existsSync(path)) throw new Error(`ZAP Automation Framework plan not found at: "${path}"`);
    content = readFileSync(path, "utf8");
  } else if (options.mode === "api" || options.apiSpec) {
    let spec = options.apiSpec;
    if (!spec) throw new Error("An OpenAPI file or URL is required.");
    if (!/^https?:\/\//.test(spec)) {
      const destination = join(runDir, "openapi" + (spec.endsWith(".json") ? ".json" : ".yaml"));
      copyFileSync(resolve(cwd, spec), destination);
      spec = docker ? `/zap/reports/${destination.split(/[\\/]/).pop()}` : destination;
    }
    content = buildApiPlan({ apiFileOrUrl: spec, targetUrl: options.target, reportDir });
  } else {
    content = buildBaselinePlan({ targetUrl: options.target ?? "http://127.0.0.1:4173", reportDir,
      maxDurationMins: options.spiderDuration });
  }
  const safety = validateSecurityPlanSafety(content, { allowExternal: options.allowExternal, allowActive: options.activeScan });
  if (!safety.safe) throw new Error(safety.reason ?? "Security guardrail violation");
  const plan = parse(content) as ZapAutomationPlan;
  if (!plan || !Array.isArray(plan.jobs)) throw new Error("Invalid AF plan: expected jobs array.");
  // Preserve workload jobs. Redirect existing report jobs, never invent missing evidence jobs.
  for (const job of plan.jobs) {
    if (job.type === "report") {
      job.parameters = { ...job.parameters, reportDir };
      if (["traditional-json", "traditional-html"].includes(String(job.parameters.template))) {
        job.parameters.reportFile = "zap-report";
      }
    }
  }
  const planPath = join(runDir, "plan.yaml");
  content = stringify(plan);
  writeFileSync(planPath, docker ? adjustPlanForDockerNetworking(content) : content);
  const container = `goodgirl-zap-${runId}`;
  const args = docker ? ["run", "--rm", "--name", container, "-u", "0:0", "-w", "/zap/wrk",
    "-v", `${cwd}:/zap/wrk:rw`, "-v", `${runDir}:/zap/reports:rw`,
    ...(platform() === "linux" ? ["--network=host"] : ["--add-host=host.docker.internal:host-gateway"]),
    ...Object.entries(options.env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    engine.image!, "zap.sh", "-cmd", "-autorun", "/zap/reports/plan.yaml"]
    : ["-cmd", "-autorun", planPath];
  args.push(...(options.passthroughArgs ?? []));
  let exitCode = 1;
  let signal: string | null = null;
  let interrupted = false;
  let timedOut = false;
  let executionError: string | undefined;
  let output = "";
  const proc = spawn(docker ? "docker" : engine.command!, args, {
    cwd, stdio: options.raw ? "inherit" : ["ignore", "pipe", "pipe"], env: { ...process.env, ...options.env },
  });
  const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-16000); };
  proc.stdout?.on("data", capture);
  proc.stderr?.on("data", capture);
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = (sig: NodeJS.Signals) => {
    if (docker) spawn.sync("docker", ["rm", "-f", container], { timeout: 5000, stdio: "ignore" });
    if (platform() === "win32" && proc.pid) spawn.sync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { timeout: 5000, stdio: "ignore" });
    else proc.kill(sig);
    forceTimer = setTimeout(() => { if (proc.exitCode === null && proc.signalCode === null) proc.kill("SIGKILL"); }, 3000);
  };
  const onInterrupt = () => { interrupted = true; stop("SIGINT"); };
  const onTerminate = () => { interrupted = true; stop("SIGTERM"); };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  const timer = setTimeout(() => { timedOut = true; stop("SIGTERM"); },
    (options.timeoutSeconds ?? DEFAULT_SECURITY_TIMEOUT_SECONDS) * 1000);
  try {
    await new Promise<void>((done) => {
      proc.on("error", (error) => { executionError = error.message; done(); });
      proc.on("close", (code, sig) => { exitCode = code ?? 1; signal = sig; done(); });
    });
  } finally {
    clearTimeout(timer);
    if (forceTimer) clearTimeout(forceTimer);
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
  const jsonPath = join(runDir, "zap-report.json");
  const htmlPath = join(runDir, "zap-report.html");
  let parsed: ReturnType<typeof parseZapJsonReport> | undefined;
  let reportError: string | undefined;
  if (existsSync(jsonPath)) {
    try { parsed = parseZapJsonReport(jsonPath, { failOnRisk: options.failOnRisk ?? DEFAULT_SECURITY_FAIL_ON_RISK }); }
    catch (error) { reportError = error instanceof Error ? error.message : String(error); }
  }
  let status: NonNullable<SecurityRunSummary["status"]>;
  let failureReason: string | undefined;
  if (timedOut || interrupted || signal) {
    status = "incomplete";
    failureReason = timedOut ? "ZAP scan timed out; completion is not verified." : "ZAP scan was interrupted; completion is not verified.";
  } else if (executionError || ![0, 2].includes(exitCode)) {
    status = "engine-failure";
    failureReason = executionError ?? `ZAP execution failed with exit code ${exitCode}: ${output.trim()}`;
  } else if (!parsed) {
    status = reportError ? "malformed-report" : "missing-report";
    failureReason = reportError ?? "Incomplete scan: required current-run ZAP JSON report was not generated. Include a traditional-json report job in the AF plan.";
  } else if (!parsed.thresholdPassed) {
    status = "risk-failure";
    failureReason = `Security risk threshold breached (${options.failOnRisk ?? DEFAULT_SECURITY_FAIL_ON_RISK}).`;
  } else status = parsed.riskSummary.total ? "findings" : "completed";
  const summary: SecurityRunSummary = {
    target: options.target, planPath: options.planPath ?? planPath, runDir,
    durationMs: Date.now() - startTime, timestamp: new Date().toISOString(), exitCode, signal, status,
    success: status === "completed" || status === "findings",
    thresholdPassed: parsed?.thresholdPassed ?? false, riskSummary: parsed?.riskSummary ?? null, alerts: parsed?.alerts ?? [],
    reportPathJson: parsed ? jsonPath : undefined,
    reportPathHtml: parsed && existsSync(htmlPath) ? htmlPath : undefined,
    engine: { type: engine.engine, command: engine.command, version: engine.version, image: engine.image, details: engine.details },
    failureReason,
  };
  if (options.htmlReportPath && summary.reportPathHtml) {
    const destination = resolve(cwd, options.htmlReportPath); mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(summary.reportPathHtml, destination);
  }
  writeFileSync(join(runDir, "results.json"), JSON.stringify(summary, null, 2));
  writeFileSync(paths.securityResultsJsonPath, JSON.stringify(summary, null, 2));
  if (options.jsonReportPath) {
    const destination = resolve(cwd, options.jsonReportPath); mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, JSON.stringify(summary, null, 2));
  }
  return summary;
}
