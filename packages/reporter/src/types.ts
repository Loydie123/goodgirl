export interface PlaywrightTestError {
  message?: string;
  stack?: string;
  value?: string;
}

export interface PlaywrightTestResult {
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration: number;
  errors: PlaywrightTestError[];
}

export interface PlaywrightTest {
  projectName?: string;
  status: "expected" | "unexpected" | "flaky" | "skipped";
  results: PlaywrightTestResult[];
}

export interface PlaywrightSpec {
  title: string;
  ok: boolean;
  file?: string;
  line?: number;
  column?: number;
  tests: PlaywrightTest[];
}

export interface PlaywrightSuite {
  title: string;
  file?: string;
  line?: number;
  column?: number;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

export interface PlaywrightJsonReport {
  config: unknown;
  suites?: PlaywrightSuite[];
  errors: PlaywrightTestError[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  };
}
