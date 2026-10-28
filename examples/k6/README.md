# GoodGirl CLI — Load Testing Guide (Grafana k6)

Welcome to the GoodGirl Load Testing Guide! This folder contains ready-to-use **Grafana k6** scripts so you can test the speed, stability, and capacity of your website or API in minutes.

---

## Quick Start (3 Easy Steps)

### Step 1: Make sure `k6` is installed
If you haven't installed Grafana k6 yet, run one of these commands in your terminal:
- **Windows (PowerShell):** `winget install k6 --source winget` *(or `choco install k6`)*
- **macOS:** `brew install k6`
- **Linux (Ubuntu/Debian):** `sudo apt-get install k6`

### Step 2: Check if everything is ready
Run the built-in load doctor to verify your setup:
```bash
pnpm qa load doctor
```
*(All 6 checks should show `[PASS]`.)*

### Step 3: Run your first load test
Run the built-in smoke test (GoodGirl automatically starts a local test server on port `4173` if needed):
```bash
pnpm qa load run examples/k6/smoke.js
```

---

## Which Load Test Should I Run?

Not sure which script to pick? Use this cheat sheet:

| Script | Test Type | When to Use It | Default Traffic |
| :--- | :--- | :--- | :--- |
| [`smoke.js`](./smoke.js) | **Smoke Test** | Run this **first** to verify your script works and the server responds with zero errors under minimal load. | 1 user for 3s |
| [`load.js`](./load.js) | **Normal Load Test** | Simulate expected day-to-day traffic (gradual ramp-up, steady traffic, and ramp-down). | Ramps up to 5 users over 8s |
| [`stress.js`](./stress.js) | **Stress Test** | Push your server harder than normal traffic to see how it handles heavy load and find bottlenecks. | Ramps up to 15 users over 8s |
| [`spike.js`](./spike.js) | **Spike Test** | Simulate a sudden surge of users (e.g., flash sale or viral post) and check if the server recovers cleanly. | Instant jump to 20 users |
| [`soak.js`](./soak.js) | **Soak / Endurance Test** | Run steady traffic over a longer period to catch memory leaks, database connection exhaustion, or slowdowns. | 4 users for 6s *(override with `--duration`)* |
| [`arrival-rate.js`](./arrival-rate.js) | **Constant Request Rate** | Maintain a fixed number of requests per second (20 req/s) regardless of how fast or slow the server responds. | 20 iterations/sec for 3s |
| [`custom-metrics.js`](./custom-metrics.js) | **Custom Metrics Demo** | Track custom business metrics (`Trend`, `Rate`, `Counter`, `Gauge`) alongside standard HTTP metrics. | 3 users for 3s |

---

## How to Load Test Your Own Website or API

### 1. Test an External or Staging URL
By default, GoodGirl blocks non-local URLs (`localhost` / `127.0.0.1`) so you don't accidentally flood a live production server.
To test your staging or external server, pass `-e BASE_URL=...` and `--allow-external`:

```bash
# Run a smoke check against your staging server
pnpm qa load run examples/k6/smoke.js \
  -e BASE_URL=https://staging.your-app.com \
  --allow-external
```

### 2. Change the Number of Users (`--vus`) and Duration (`--duration`)
You don't need to edit the `.js` file to change the traffic size—just pass CLI flags:

```bash
# Simulate 25 concurrent users for 1 minute
pnpm qa load run examples/k6/smoke.js \
  -e BASE_URL=https://staging.your-app.com \
  --vus 25 \
  --duration 1m \
  --allow-external
```

### 3. Use Custom Ramp-Up / Ramp-Down Stages (`--stage`)
Want to gradually increase users and then ramp down? Use `--stage <duration>:<users>`:

```bash
# Ramp to 10 users over 15s, hold 30 users for 30s, ramp down to 0 over 10s
pnpm qa load run examples/k6/load.js \
  -e BASE_URL=https://staging.your-app.com \
  --stage 15s:10 30s:30 10s:0 \
  --allow-external
```

### 4. Create Your Own Simple Load Script
You can create your own `.js` file anywhere in your project (for example, `my-api-load.js`):

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4173";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],   // Less than 1% failed requests
    http_req_duration: ["p(95)<500"], // 95% of requests must finish under 500ms
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(0.5); // Wait 0.5s between requests per virtual user
}
```

Then run it with:
```bash
pnpm qa load run my-api-load.js
```

---

## How to Read the Terminal Summary

After every run, GoodGirl prints a clean summary card:

- **Overall Status (`PASSED` / `FAILED`)**: Shows whether all checks and performance thresholds passed.
- **HTTP Latency (`http_req_duration`)**:
  - `avg` / `med`: Average and median response time.
  - `p(90)` / `p(95)` / `p(99)`: **90%, 95%, and 99% of requests were faster than this number.** *(Focus on `p(95)` and `p(99)` to spot slow requests affecting real users!)*
- **Throughput & Requests**:
  - `Total Requests (req/s)`: Total HTTP calls made and the requests-per-second rate.
  - `Failed Requests`: Number and percentage of HTTP requests that timed out or returned errors.
- **Threshold Results**: Pass/fail rules defined in your script (if any threshold fails, the command exits with code `99` so your CI pipeline catches slowdowns automatically).
- **JSON Reports**:
  - `goodgirl-results/load-summary.json` — Clean, normalized GoodGirl JSON report.
  - `goodgirl-results/k6-raw-summary.json` — Raw native k6 summary output.

---

## Useful Extra Flags

```bash
# Save the normalized JSON report to a custom file path
pnpm qa load run examples/k6/smoke.js --json-report reports/my-load-report.json

# Stream raw k6 console output while running
pnpm qa load run examples/k6/smoke.js --raw

# Pass any native k6 flag after "--"
pnpm qa load run examples/k6/smoke.js -- --http-debug
```

## Safety Controls

By default, GoodGirl load tests only allow local targets (`127.0.0.1`, `localhost`, `::1`). To test remote or staging servers, pass `--allow-external` on the CLI or set `k6.allowExternal: true` in `goodgirl.config.ts`.

> **Limitation Notice**: Target safety verification inspects literal URL strings inside script files and CLI `--env` arguments. Dynamically constructed URLs or HTTP server redirects cannot be guaranteed detectable via static inspection.
