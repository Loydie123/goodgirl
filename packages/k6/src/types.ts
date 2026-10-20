import type {
  LoadCheckResult,
  LoadHttpLatencySummary,
  LoadMetricValue,
  LoadRunOptions,
  LoadRunSummary,
  LoadThresholdResult,
} from "@goodgirl/shared";

export type K6ExecutorType =
  | "shared-iterations"
  | "per-vu-iterations"
  | "constant-vus"
  | "ramping-vus"
  | "constant-arrival-rate"
  | "ramping-arrival-rate"
  | "externally-controlled";

export interface K6RawCheck {
  id: string;
  name: string;
  path: string;
  passes: number;
  fails: number;
}

export interface K6RawGroup {
  id: string;
  name: string;
  path: string;
  groups?: Record<string, K6RawGroup>;
  checks?: Record<string, K6RawCheck>;
}

export interface K6RawMetric {
  type?: "trend" | "rate" | "counter" | "gauge";
  contains?: string;
  thresholds?: Record<string, boolean>; // expression -> crossed (true means threshold failed)
  // Trend
  avg?: number;
  min?: number;
  med?: number;
  max?: number;
  "p(90)"?: number;
  "p(95)"?: number;
  "p(99)"?: number;
  // Counter & Rate
  count?: number;
  rate?: number;
  // Gauge & Rate
  value?: number;
  passes?: number;
  fails?: number;
}

export interface K6SummaryJson {
  root_group: K6RawGroup;
  metrics: Record<string, K6RawMetric>;
}

export type {
  LoadCheckResult,
  LoadHttpLatencySummary,
  LoadMetricValue,
  LoadRunOptions,
  LoadRunSummary,
  LoadThresholdResult,
};
