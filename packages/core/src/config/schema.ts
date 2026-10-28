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
  DEFAULT_VIDEO,
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

export const browserProjectSchema = z.object({
  name: z.string().min(1, "Project name must not be empty"),
  browser: z.enum(["chromium", "firefox", "webkit"]).optional(),
  device: z.string().optional(),
  use: z.record(z.unknown()).optional(),
  testMatch: z.union([z.string(), z.array(z.string())]).optional(),
  testIgnore: z.union([z.string(), z.array(z.string())]).optional(),
});

export const k6ConfigSchema = z
  .object({
    binaryPath: z.string().optional(),
    allowedTargets: z.array(z.string()).optional(),
    allowExternalTargets: z.boolean().optional(),
    allowExternal: z.boolean().optional(),
    defaultVUs: z.number().int().positive().optional(),
    defaultDuration: z.string().optional(),
    summaryTrendStats: z.array(z.string()).optional(),
    resultsDir: z.string().optional(),
  })
  .optional();

export const securityConfigSchema = z
  .object({
    dockerImage: z.string().optional(),
    zapPath: z.string().optional(),
    allowExternal: z.boolean().default(false),
    allowExternalTargets: z.boolean().default(false),
    allowedTargets: z.array(z.string()).default([]),
    failOnRisk: z.enum(["High", "Medium", "Low", "Informational", "never"]).default("High"),
    defaultTimeoutSeconds: z.number().int().positive().default(300),
    resultsDir: z.string().optional(),
  })
  .optional();

export const goodGirlConfigSchema = z.object({
  projectName: z.string().default("GoodGirl QA Project"),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  browser: z.enum(["chromium", "firefox", "webkit"]).default(DEFAULT_BROWSER),
  browsers: z.array(z.enum(["chromium", "firefox", "webkit"])).optional(),
  projects: z.array(browserProjectSchema).optional(),
  timeout: z.number().int().positive().default(DEFAULT_TIMEOUT_MS),
  retries: z.number().int().min(0).default(DEFAULT_RETRIES),
  workers: z.union([z.number().int().positive(), z.string().regex(/^(?:[1-9]\d?|100)%$/)]).optional(),
  fullyParallel: z.boolean().optional(),
  screenshots: z.enum(["off", "on", "only-on-failure"]).default(DEFAULT_SCREENSHOT),
  trace: z
    .enum(["off", "on", "retain-on-failure", "on-first-retry"])
    .default(DEFAULT_TRACE),
  video: z
    .enum(["off", "on", "retain-on-failure", "on-first-retry"])
    .default(DEFAULT_VIDEO),
  testDir: z.string().default(DEFAULT_TEST_DIR),
  resultsDir: z.string().default(DEFAULT_RESULTS_DIR),
  webServer: webServerSchema,
  k6: k6ConfigSchema,
  security: securityConfigSchema,
  use: z.record(z.unknown()).optional(),
});

export type ValidatedGoodGirlConfig = z.infer<typeof goodGirlConfigSchema>;

