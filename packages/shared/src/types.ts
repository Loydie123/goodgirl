export type BrowserType = "chromium" | "firefox" | "webkit";
export type ScreenshotOption = "off" | "on" | "only-on-failure";
export type TraceOption = "off" | "on" | "retain-on-failure" | "on-first-retry";
export type VideoOption = "off" | "on" | "retain-on-failure" | "on-first-retry";

export interface BrowserProjectConfig {
  name: string;
  browser?: BrowserType;
  device?: string;
  use?: Record<string, unknown>;
  testMatch?: string | string[];
  testIgnore?: string | string[];
}

export interface WebServerConfig {
  command: string;
  port?: number;
  url?: string;
  reuseExistingServer?: boolean;
  timeout?: number;
}

export interface K6Config {
  allowExternal?: boolean;
  binaryPath?: string;
  allowedTargets?: string[];
  allowExternalTargets?: boolean;
  defaultVUs?: number;
  defaultDuration?: string;
  summaryTrendStats?: string[];
  resultsDir?: string;
}

export interface SecurityConfig {
  dockerImage?: string;
  zapPath?: string;
  allowExternal?: boolean;
  allowExternalTargets?: boolean;
  allowedTargets?: string[];
  failOnRisk?: "High" | "Medium" | "Low" | "Informational" | "never";
  defaultTimeoutSeconds?: number;
  resultsDir?: string;
}

export interface GoodGirlConfig {
  projectName?: string;
  baseURL?: string;
  browser?: BrowserType;
  browsers?: BrowserType[];
  projects?: BrowserProjectConfig[];
  timeout?: number;
  retries?: number;
  workers?: number | string;
  fullyParallel?: boolean;
  screenshots?: ScreenshotOption;
  trace?: TraceOption;
  video?: VideoOption;
  testDir?: string;
  resultsDir?: string;
  webServer?: WebServerConfig;
  k6?: K6Config;
  security?: SecurityConfig;
  use?: Record<string, unknown>;
}

export type TestType = "e2e" | "api" | "all";
export type ReportFormat = "html" | "json";

export interface TestRunOptions {
  type: TestType;
  files?: string[];
  browser?: BrowserType | "all";
  playwrightConfigPath?: string;
  project?: string;
  projects?: string[];
  headed?: boolean;
  grep?: string;
  grepInvert?: string;
  workers?: number | string;
  retries?: number;
  timeout?: number;
  shard?: string;
  repeatEach?: number;
  maxFailures?: number;
  lastFailed?: boolean;
  list?: boolean;
  debug?: boolean;
  ui?: boolean;
  trace?: TraceOption;
  video?: VideoOption;
  passthroughArgs?: string[];
  configPath?: string;
  cwd?: string;
  reporter?: string;
}

export interface TestFailureDetail {
  title: string;
  project?: string;
  location?: string;
  error?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
  reportPath?: string;
  resultsJsonPath?: string;
  success: boolean;
  failures: TestFailureDetail[];
}

export type DoctorStatus = "pass" | "fail" | "warn";

export interface DoctorCheckResult {
  name: string;
  status: DoctorStatus;
  message: string;
  details?: string;
}

export interface DoctorReport {
  checks: DoctorCheckResult[];
  healthy: boolean;
}

export interface LoadRunOptions {
  script: string;
  vus?: number;
  duration?: string;
  iterations?: number;
  stages?: string[];
  env?: Record<string, string>;
  summaryTrendStats?: string;
  summaryExport?: string;
  jsonReportPath?: string;
  allowExternal?: boolean;
  raw?: boolean;
  passthroughArgs?: string[];
  configPath?: string;
  cwd?: string;
}

export interface LoadMetricValue {
  name: string;
  type: "trend" | "rate" | "counter" | "gauge";
  avg?: number;
  min?: number;
  med?: number;
  max?: number;
  p90?: number;
  p95?: number;
  p99?: number;
  count?: number;
  rate?: number;
  value?: number;
  passes?: number;
  fails?: number;
  thresholds?: Record<string, boolean>; // expression -> crossed/failed
}

export interface LoadCheckResult {
  name: string;
  path: string;
  passes: number;
  fails: number;
  successRate: number;
}

export interface LoadThresholdResult {
  metric: string;
  expression: string;
  passed: boolean;
}

export interface LoadHttpLatencySummary {
  avg: number;
  min: number;
  med: number;
  max: number;
  p90: number;
  p95: number;
  p99?: number;
}

export interface LoadRunSummary {
  script: string;
  durationMs: number;
  timestamp: string;
  exitCode: number;
  success: boolean;
  thresholdsPassed: boolean;
  metrics: Record<string, LoadMetricValue>;
  checks: LoadCheckResult[];
  thresholds: LoadThresholdResult[];
  httpReqDuration?: LoadHttpLatencySummary;
  httpReqs?: { count: number; rate: number };
  httpReqFailed?: { rate: number; passes: number; fails: number };
  vus?: { value: number; min: number; max: number };
  iterations?: { count: number; rate: number };
  dataSent?: { count: number; rate: number };
  dataReceived?: { count: number; rate: number };
  resultsJsonPath?: string;
}

export type ZapRiskLevel = "High" | "Medium" | "Low" | "Informational";
export type ZapConfidenceLevel = "High" | "Medium" | "Low" | "False Positive" | "User Confirmed";

export interface SecurityAlertInstance {
  uri: string;
  method: string;
  param?: string;
  attack?: string;
  evidence?: string;
}

export interface SecurityAlert {
  pluginId: string;
  name: string;
  risk: ZapRiskLevel;
  riskCode: number;
  confidence: ZapConfidenceLevel;
  description: string;
  solution: string;
  cweId?: string;
  wascId?: string;
  reference?: string;
  instances: SecurityAlertInstance[];
  count: number;
}

export interface SecurityRiskSummary {
  high: number;
  medium: number;
  low: number;
  informational: number;
  total: number;
}

export interface SecurityEngineInfo {
  type: "docker" | "local" | "none";
  version?: string;
  image?: string;
  command?: string;
  details?: string;
}

export interface SecurityRunOptions {
  spiderDuration?: number;
  jsonReportPath?: string;
  htmlReportPath?: string;
  target?: string;
  planPath?: string;
  apiSpec?: string;
  mode?: "baseline" | "api" | "plan";
  activeScan?: boolean;
  allowExternal?: boolean;
  failOnRisk?: ZapRiskLevel | "never";
  timeoutSeconds?: number;
  dockerImage?: string;
  zapPath?: string;
  reportDir?: string;
  format?: "html" | "json" | "both";
  env?: Record<string, string>;
  contextName?: string;
  configPath?: string;
  cwd?: string;
  raw?: boolean;
  passthroughArgs?: string[];
}

export interface SecurityRunSummary {
  target?: string;
  planPath?: string;
  durationMs: number;
  timestamp: string;
  exitCode: number;
  success: boolean;
  thresholdPassed: boolean;
  riskSummary: SecurityRiskSummary | null;
  status?: "completed" | "findings" | "risk-failure" | "engine-failure" | "incomplete" | "missing-report" | "malformed-report";
  signal?: string | null;
  runDir?: string;
  alerts: SecurityAlert[];
  reportPathJson?: string;
  reportPathHtml?: string;
  engine: SecurityEngineInfo;
  failureReason?: string;
}

