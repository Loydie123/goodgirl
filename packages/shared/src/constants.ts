import type { BrowserType, ScreenshotOption, TraceOption, VideoOption } from "./types.js";

export const CONFIG_FILE_NAMES = [
  "goodgirl.config.ts",
  "goodgirl.config.js",
  "goodgirl.config.mjs",
] as const;

export const DEFAULT_RESULTS_DIR = "goodgirl-results";
export const DEFAULT_JSON_REPORT_NAME = "results.json";
export const DEFAULT_HTML_REPORT_DIR_NAME = "html";
export const DEFAULT_K6_RESULTS_NAME = "k6-results.json";
export const DEFAULT_K6_SUMMARY_TREND_STATS = "avg,min,med,max,p(90),p(95),p(99)";
export const DEFAULT_ALLOWED_HOSTS = ["127.0.0.1", "localhost", "::1", "0.0.0.0"] as const;

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_RETRIES = 1;
export const DEFAULT_BROWSER: BrowserType = "chromium";
export const DEFAULT_SCREENSHOT: ScreenshotOption = "only-on-failure";
export const DEFAULT_TRACE: TraceOption = "retain-on-failure";
export const DEFAULT_VIDEO: VideoOption = "off";
export const DEFAULT_BASE_URL = "http://127.0.0.1:4173";
export const DEFAULT_TEST_DIR = "tests";

export const DEFAULT_ZAP_DOCKER_IMAGE = "ghcr.io/zaproxy/zaproxy:stable";
export const DEFAULT_ZAP_BARE_DOCKER_IMAGE = "ghcr.io/zaproxy/zaproxy:bare";
export const DEFAULT_SECURITY_RESULTS_NAME = "zap-results.json";
export const DEFAULT_SECURITY_REPORT_HTML = "zap-report.html";
export const DEFAULT_SECURITY_REPORT_JSON = "zap-report.json";
export const DEFAULT_SECURITY_FAIL_ON_RISK = "High";
export const DEFAULT_SECURITY_TIMEOUT_SECONDS = 300;
