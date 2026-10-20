import { z } from "zod";
import {
  DEFAULT_BASE_URL,
  DEFAULT_BROWSER,
  DEFAULT_RESULTS_DIR,
  DEFAULT_RETRIES,
  DEFAULT_SCREENSHOT,
  DEFAULT_TEST_DIR,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TRACE,
} from "@goodgirl/shared";

export const webServerSchema = z
  .object({
    command: z.string().min(1, "Web server command must not be empty"),
    port: z.number().int().positive().optional(),
    url: z.string().url().optional(),
    reuseExistingServer: z.boolean().default(true),
    timeout: z.number().int().positive().default(15000),
  })
  .optional();

export const goodGirlConfigSchema = z.object({
  projectName: z.string().default("GoodGirl QA Project"),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  browser: z.enum(["chromium", "firefox", "webkit"]).default(DEFAULT_BROWSER),
  timeout: z.number().int().positive().default(DEFAULT_TIMEOUT_MS),
  retries: z.number().int().min(0).default(DEFAULT_RETRIES),
  screenshots: z.enum(["off", "on", "only-on-failure"]).default(DEFAULT_SCREENSHOT),
  trace: z
    .enum(["off", "on", "retain-on-failure", "on-first-retry"])
    .default(DEFAULT_TRACE),
  testDir: z.string().default(DEFAULT_TEST_DIR),
  resultsDir: z.string().default(DEFAULT_RESULTS_DIR),
  webServer: webServerSchema,
});

export type ValidatedGoodGirlConfig = z.infer<typeof goodGirlConfigSchema>;
