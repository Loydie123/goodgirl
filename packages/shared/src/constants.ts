import type { BrowserType, ScreenshotOption, TraceOption, VideoOption } from "./types.js";

export const CONFIG_FILE_NAMES = [
  "goodgirl.config.ts",
  "goodgirl.config.js",
  "goodgirl.config.mjs",
] as const;

export const DEFAULT_RESULTS_DIR = "goodgirl-results";
export const DEFAULT_JSON_REPORT_NAME = "results.json";
export const DEFAULT_HTML_REPORT_DIR_NAME = "html";

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_RETRIES = 1;
export const DEFAULT_BROWSER: BrowserType = "chromium";
export const DEFAULT_SCREENSHOT: ScreenshotOption = "only-on-failure";
export const DEFAULT_TRACE: TraceOption = "retain-on-failure";
export const DEFAULT_VIDEO: VideoOption = "off";
export const DEFAULT_BASE_URL = "http://127.0.0.1:4173";
export const DEFAULT_TEST_DIR = "tests";
