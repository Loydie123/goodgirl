# GoodGirl CLI — Native Grafana k6 Performance Testing

This directory contains executable native Grafana k6 performance testing scripts designed to run against the hermetic GoodGirl test bench fixture or custom environments.

## Available Workloads

| Script | Workload Type | Description |
| :--- | :--- | :--- |
| [`smoke.js`](file:///Users/loyd/goodgirl/examples/k6/smoke.js) | Smoke Validation | Fast, minimal 1 VU check against `/api/health` and `/api/users`. |
| [`load.js`](file:///Users/loyd/goodgirl/examples/k6/load.js) | Ramping Load | Multi-stage ramp-up, steady state, and ramp-down with POST requests. |
| [`stress.js`](file:///Users/loyd/goodgirl/examples/k6/stress.js) | Stress Testing | Higher concurrency (up to 15 VUs) to test system limits. |
| [`spike.js`](file:///Users/loyd/goodgirl/examples/k6/spike.js) | Spike Testing | Sharp sudden surge in virtual users (20 VUs) to test elasticity and recovery. |
| [`soak.js`](file:///Users/loyd/goodgirl/examples/k6/soak.js) | Bounded Soak | Sustained traffic over time to identify memory leaks or connection drops. |
| [`arrival-rate.js`](file:///Users/loyd/goodgirl/examples/k6/arrival-rate.js) | Arrival Rate | Open-model workload testing with `constant-arrival-rate` executor. |
| [`custom-metrics.js`](file:///Users/loyd/goodgirl/examples/k6/custom-metrics.js) | Custom Metrics | Demonstrates native `Trend`, `Rate`, `Counter`, `Gauge` and custom thresholds. |

## Running Load Tests

### 1. Verify k6 Environment
```bash
pnpm qa load doctor
```

### 2. Execute Workloads
```bash
# Run smoke validation
pnpm qa load run examples/k6/smoke.js

# Run ramping load test
pnpm qa load run examples/k6/load.js

# Run stress test
pnpm qa load run examples/k6/stress.js

# Run spike test
pnpm qa load run examples/k6/spike.js

# Run soak test
pnpm qa load run examples/k6/soak.js

# Run arrival rate test
pnpm qa load run examples/k6/arrival-rate.js

# Run custom metrics test
pnpm qa load run examples/k6/custom-metrics.js
```

### 3. CLI Overrides
```bash
# Override virtual users and duration
pnpm qa load run examples/k6/smoke.js --vus 5 --duration 10s

# Pass custom environment variable
pnpm qa load run examples/k6/smoke.js -e BASE_URL=http://127.0.0.1:4173

# Authorize external target execution
pnpm qa load run examples/k6/smoke.js --allow-external -e BASE_URL=https://staging.internal.net

# Stream raw k6 output
pnpm qa load run examples/k6/smoke.js --raw

# Pass native k6 flags
pnpm qa load run examples/k6/smoke.js -- --http-debug
```

## Safety Controls
By default, GoodGirl load tests only permit execution against localhost and loopback interfaces (`127.0.0.1`, `localhost`, `::1`). To execute against remote or non-local endpoints, pass `--allow-external` or configure `k6.allowExternal: true` in `goodgirl.config.ts`.

> **Limitation Notice**: Target safety verification inspects literal URL string matches within script source files. Dynamically constructed URLs, environment variable targets, or HTTP server redirects cannot be guaranteed detectable via static inspection.
