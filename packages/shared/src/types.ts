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
  use?: Record<string, unknown>;
}

export type TestType = "e2e" | "api" | "all";
export type ReportFormat = "html" | "json";

export interface TestRunOptions {
  type: TestType;
  files?: string[];
  browser?: BrowserType;
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
