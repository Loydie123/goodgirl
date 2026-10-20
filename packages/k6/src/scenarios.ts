import type { K6ExecutorType } from "./types.js";

export interface K6Stage {
  duration: string;
  target: number;
}

export interface K6ScenarioConfig {
  executor: K6ExecutorType;
  vus?: number;
  maxVUs?: number;
  duration?: string;
  iterations?: number;
  stages?: K6Stage[];
  rate?: number;
  timeUnit?: string;
  preAllocatedVUs?: number;
  gracefulStop?: string;
  gracefulRampDown?: string;
  tags?: Record<string, string>;
  env?: Record<string, string>;
  exec?: string;
}

/**
 * Standard scenario presets for k6 workload design.
 */
export const SCENARIO_PRESETS = {
  /**
   * Smoke test: minimal workload to verify system works without errors under minimal load.
   */
  smoke: {
    executor: "constant-vus" as const,
    vus: 1,
    duration: "5s",
  },

  /**
   * Typical load test: ramps up to standard operational traffic, holds, and ramps down.
   */
  load: {
    executor: "ramping-vus" as const,
    stages: [
      { duration: "10s", target: 10 },
      { duration: "20s", target: 10 },
      { duration: "5s", target: 0 },
    ],
  },

  /**
   * Stress test: ramps load progressively beyond standard capacity to find breaking points.
   */
  stress: {
    executor: "ramping-vus" as const,
    stages: [
      { duration: "10s", target: 10 },
      { duration: "15s", target: 25 },
      { duration: "10s", target: 35 },
      { duration: "5s", target: 0 },
    ],
  },

  /**
   * Spike test: sudden extreme surge to test elasticity, recovery, and resilience.
   */
  spike: {
    executor: "ramping-vus" as const,
    stages: [
      { duration: "5s", target: 2 },
      { duration: "3s", target: 30 },
      { duration: "10s", target: 30 },
      { duration: "3s", target: 2 },
      { duration: "5s", target: 0 },
    ],
  },

  /**
   * Soak test: sustained moderate load over a bounded duration to identify memory leaks or resource exhaustion.
   */
  soak: {
    executor: "constant-vus" as const,
    vus: 5,
    duration: "30s",
  },

  /**
   * Constant arrival rate: fixed request rate per second independent of system response time.
   */
  constantArrivalRate: (rate = 20, duration = "15s", preAllocatedVUs = 10, maxVUs = 50) => ({
    executor: "constant-arrival-rate" as const,
    rate,
    timeUnit: "1s",
    duration,
    preAllocatedVUs,
    maxVUs,
  }),
};
