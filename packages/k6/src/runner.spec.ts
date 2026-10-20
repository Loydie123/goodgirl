import { describe, expect, it } from "vitest";
import { buildK6RunArgs } from "./runner.js";

describe("k6 Argument Builder", () => {
  it("builds basic k6 run arguments with defaults", () => {
    const args = buildK6RunArgs("smoke.js", "/path/to/summary.json", {
      script: "smoke.js",
    });

    expect(args[0]).toBe("run");
    expect(args).toContain("--summary-export=/path/to/summary.json");
    expect(args.some((a) => a.startsWith("--summary-trend-stats="))).toBe(true);
    expect(args[args.length - 1]).toBe("smoke.js");
  });

  it("applies VUs, duration, and iterations overrides", () => {
    const args = buildK6RunArgs("test.js", "/summary.json", {
      script: "test.js",
      vus: 10,
      duration: "30s",
      iterations: 100,
    });

    expect(args).toContain("--vus=10");
    expect(args).toContain("--duration=30s");
    expect(args).toContain("--iterations=100");
  });

  it("applies multiple stages and env variables", () => {
    const args = buildK6RunArgs("load.js", "/summary.json", {
      script: "load.js",
      stages: ["5s:5", "10s:10", "5s:0"],
      env: {
        BASE_URL: "http://127.0.0.1:4173",
        API_KEY: "secret",
      },
    });

    expect(args).toContain("--stage=5s:5");
    expect(args).toContain("--stage=10s:10");
    expect(args).toContain("--stage=5s:0");
    expect(args).toContain("--env=BASE_URL=http://127.0.0.1:4173");
    expect(args).toContain("--env=API_KEY=secret");
  });

  it("appends passthrough arguments", () => {
    const args = buildK6RunArgs("custom.js", "/summary.json", {
      script: "custom.js",
      passthroughArgs: ["--http-debug=full", "--no-connection-reuse"],
    });

    expect(args).toContain("--http-debug=full");
    expect(args).toContain("--no-connection-reuse");
  });

  it("applies config defaults when CLI options are omitted", () => {
    const args = buildK6RunArgs(
      "test.js",
      "/summary.json",
      { script: "test.js" },
      {
        defaultVUs: 2,
        defaultDuration: "10s",
        summaryTrendStats: ["avg", "p(90)", "p(99)"],
      },
    );

    expect(args).toContain("--vus=2");
    expect(args).toContain("--duration=10s");
    expect(args).toContain("--summary-trend-stats=avg,p(90),p(99)");
  });
});
