export type BrowserType = "chromium" | "firefox" | "webkit";
export type ScreenshotOption = "off" | "on" | "only-on-failure";
export type TraceOption = "off" | "on" | "retain-on-failure" | "on-first-retry";

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
  timeout?: number;
  retries?: number;
  screenshots?: ScreenshotOption;
  trace?: TraceOption;
  testDir?: string;
  resultsDir?: string;
  webServer?: WebServerConfig;
}

export type TestType = "e2e" | "api" | "all";
export type ReportFormat = "html" | "json";

export interface TestRunOptions {
  type: TestType;
  headed?: boolean;
  grep?: string;
  configPath?: string;
  cwd?: string;
  reporter?: string;
}

export interface TestFailureDetail {
  title: string;
  location?: string;
  error?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
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
