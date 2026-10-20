# GoodGirl CLI — Native OWASP ZAP Security Testing

This directory contains executable OWASP ZAP Automation Framework (AF) plans and OpenAPI specifications designed to run against the hermetic GoodGirl test bench fixture or custom environments.

## Available Security Workloads & Plans

| File | Type | Description |
| :--- | :--- | :--- |
| [`baseline.yaml`](file:///Users/loyd/goodgirl/examples/zap/baseline.yaml) | Baseline Scan | Fast passive scan and spider crawl against the target web application. |
| [`api-scan.yaml`](file:///Users/loyd/goodgirl/examples/zap/api-scan.yaml) | OpenAPI Scan | Imports the OpenAPI schema to identify all endpoints and parameters before passive inspection. |
| [`authenticated.yaml`](file:///Users/loyd/goodgirl/examples/zap/authenticated.yaml) | Authenticated Scan | Template using environment variables for bearer tokens and credentials without hardcoding secrets. |
| [`openapi.json`](file:///Users/loyd/goodgirl/examples/zap/openapi.json) | OpenAPI 3.0 Spec | Complete specification for the GoodGirl local test bench endpoints. |

## Running Security Scans

### 1. Verify ZAP Environment & Diagnostics
```bash
pnpm qa security doctor
```
Checks for:
- Docker daemon status and cached ZAP container image (`ghcr.io/zaproxy/zaproxy:bare` or `stable`)
- Local standalone ZAP installation (`zap.sh` / `zap.bat`)
- Platform-specific networking requirements (`host.docker.internal` on macOS/Windows, `--network="host"` on Linux)
- Results directory permissions

### 2. Execute Automated Scans

```bash
# Run baseline passive scan against local test bench
pnpm qa security baseline --target http://127.0.0.1:4173

# Run API security scan using OpenAPI schema
pnpm qa security api examples/zap/openapi.json --target http://127.0.0.1:4173

# Run custom Automation Framework plan
pnpm qa security run examples/zap/baseline.yaml
```

### 3. Inspecting Security Reports

```bash
# View terminal summary and report location
pnpm qa security report

# Open interactive HTML report in your default browser
pnpm qa security report --open

# Output structured JSON security findings
pnpm qa security report --format json
```

## Security Guardrails & Safe Testing

GoodGirl CLI includes safety guardrails:

1. **Target Allowlist**:
   By default, scans are strictly restricted to local loopback addresses (`127.0.0.1`, `localhost`, `::1`, `host.docker.internal`). Scans against external or production domains require explicit authorization:
   ```bash
   pnpm qa security baseline --target https://staging.example.com --allow-external
   ```

2. **Active Scan Protection**:
   Active scanning sends potentially invasive attack payloads to target endpoints. Any Automation Framework plan containing an `activeScan` job will be blocked unless explicitly confirmed with `--active` or `--allow-active`:
   ```bash
   pnpm qa security run path/to/active-plan.yaml --active
   ```

3. **Credential & Token Redaction**:
   Terminal output cards automatically mask authorization tokens (`Bearer ***`, `Basic ***`), passwords, and API keys to protect sensitive information from terminal scrollback and CI logs.

4. **Failure Thresholds (`failOnRisk`)**:
   Enforce security gates in CI/CD pipelines by failing builds when alerts meet or exceed a specific risk level:
   ```bash
   pnpm qa security baseline --fail-on High
   ```
