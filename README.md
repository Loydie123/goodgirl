# GoodGirl CLI

GoodGirl CLI is a cross-platform, CLI-first QA automation toolkit built on Node.js, TypeScript, pnpm Workspaces, Turborepo, and Playwright. It gives QA engineers a unified command-line interface to orchestrate end-to-end (E2E) browser tests and REST API contract tests consistently across Windows (PowerShell), macOS, and Linux.

---

## What GoodGirl CLI Does

GoodGirl CLI simplifies test orchestration and execution for modern QA workflows:

- **Single Command Orchestration**: Execute E2E browser tests, API suites, or both through a single tool.
- **Interactive Terminal UX**: Launch guided test runs, check environment health, or view reports via a polished terminal menu without memorizing CLI arguments.
- **Direct Automation CLI**: Integrate seamlessly with CI/CD runners using declarative flags (`--headed`, `--grep`, `--format`).
- **Standardized Reporting**: Summarize total, passed, failed, and skipped tests in clean terminal output while preserving native Playwright HTML and structured JSON reports.
- **Cross-Platform Parity**: Eliminates OS discrepancies by resolving paths with Node.js path utilities and managing subprocesses via `cross-spawn`.

---

## Currently Implemented Capabilities (Phase 1)

| Capability | Status | Notes |
|---|---|---|
| E2E Browser Testing | **Implemented** | Chromium default; configurable timeouts, retries, screenshots, and tracing |
| REST API Contract Testing | **Implemented** | HTTP status verification, schema validation, payload contract testing |
| Interactive Terminal Menu | **Implemented** | Powered by `@clack/prompts` with zero-argument fallback |
| Environment Diagnostics (`doctor`) | **Implemented** | Validates Node.js >= 22, pnpm, OS arch, Playwright binaries, config, permissions |
| Project Scaffolding (`init`) | **Implemented** | Scaffolds `goodgirl.config.ts`, `tests/e2e/`, and `tests/api/` |
| Unified Reporting (`report`) | **Implemented** | Produces terminal summaries, interactive HTML reports, and structured JSON |
| Hermetic Local Test Fixture | **Implemented** | Native Node.js HTTP server for local smoke verification on `127.0.0.1:4173` |
| Grafana k6 Load Testing | *Planned (Phase 2)* | Not implemented in Phase 1 |
| OWASP ZAP Security Scanning | *Planned (Phase 2)* | Not implemented in Phase 1 |
| Execution History Database | *Planned (Phase 2)* | Not implemented in Phase 1 |

---

## Prerequisites

Before running GoodGirl CLI, ensure your system has:

- **Node.js**: `v22.0.0` or higher (verified on Node `v24.18.0`)
- **pnpm**: `v10.0.0` or higher (recommended: `11.9.0`)
- **Git**: Installed and available on system `PATH`

Verify your installed versions:

```bash
node --version
pnpm --version
git --version
```

---

## Windows PowerShell Quick Start

Follow these steps on Windows using **PowerShell**:

### 1. Clone Repository & Enter Directory
```powershell
git clone <repository-url> goodgirl
Set-Location goodgirl
```

### 2. Install Workspace Dependencies
```powershell
pnpm install --frozen-lockfile
```

### 3. Build Monorepo Workspaces
```powershell
pnpm build
```

### 4. Install Playwright Chromium Browser
```powershell
pnpm exec playwright install chromium
```

### 5. Verify System Health
```powershell
pnpm qa doctor
```

### 6. Run All Smoke Tests
```powershell
pnpm qa test all
```

---

## macOS / Linux Quick Start

Follow these steps on macOS or Linux:

### 1. Clone Repository & Enter Directory
```bash
git clone <repository-url> goodgirl
cd goodgirl
```

### 2. Install Workspace Dependencies
```bash
pnpm install --frozen-lockfile
```

### 3. Build Monorepo Workspaces
```bash
pnpm build
```

### 4. Install Playwright Chromium Browser
```bash
pnpm exec playwright install chromium
```
*(On Linux distributions, if system libraries are missing, run `pnpm exec playwright install --with-deps chromium`)*

### 5. Verify System Health
```bash
pnpm qa doctor
```

### 6. Run All Smoke Tests
```bash
pnpm qa test all
```

---

## Interactive CLI Usage

When launched without arguments, GoodGirl displays an interactive terminal menu:

```bash
pnpm qa
```

```
GoodGirl CLI — Interactive QA Menu
┌  Select an action:
│  ● Run E2E Tests       (Execute end-to-end browser tests)
│  ○ Run API Tests       (Execute API endpoint test suite)
│  ○ Run All Tests       (Execute full E2E and API test suite)
│  ○ Generate Report     (View latest HTML or JSON test report)
│  ○ Check Environment   (Validate system prerequisites & config)
│  ○ Exit                (Close GoodGirl CLI)
└
```

Use the **Up/Down Arrow** keys to navigate, **Enter** to select, or **Ctrl+C** to exit. Both interactive and direct CLI commands use the exact same underlying test runner and reporting engines.

---

## Complete Implemented Command Reference

All commands can be invoked using `pnpm qa <command>` in development, or `goodgirl <command>` when installed.

### General Commands

| Command | Description |
|---|---|
| `pnpm qa --help` | Display CLI documentation and available options |
| `pnpm qa --version` | Output installed GoodGirl version (`0.1.0`) |
| `pnpm qa doctor` | Run environment diagnostics and config validation |
| `pnpm qa init` | Scaffold `goodgirl.config.ts` and starter test suites |
| `pnpm qa init --force` | Overwrite existing starter files if present |

### Test Commands

| Command | Description |
|---|---|
| `pnpm qa test all` | Execute both E2E browser tests and REST API contract tests |
| `pnpm qa test e2e` | Execute only E2E browser tests |
| `pnpm qa test api` | Execute only REST API tests |
| `pnpm qa test e2e --headed` | Launch visible browser window during test execution |
| `pnpm qa test all --grep "<pattern>"` | Filter test cases matching a pattern, tag, or title |
| `pnpm qa test all --config <path>` | Run tests against an explicit configuration file path |

### Report Commands

| Command | Description |
|---|---|
| `pnpm qa report --format html` | Display the file path and clickable `file://` URL for the HTML report |
| `pnpm qa report --format json` | Output structured test results as JSON to stdout |

---

## Configuration Examples

GoodGirl reads its project settings from `goodgirl.config.ts` in the target project root.

### Standard Configuration (`goodgirl.config.ts`)

```typescript
import type { GoodGirlConfig } from "@goodgirl/shared";

const config: GoodGirlConfig = {
  projectName: "My Application QA",
  baseURL: "https://staging.example.com",
  browser: "chromium",
  timeout: 30000,
  retries: 1,
  screenshots: "only-on-failure",
  trace: "retain-on-failure",
  testDir: "tests",
  resultsDir: "goodgirl-results",
};

export default config;
```

### Configuration Options Reference

| Property | Type | Default | Description |
|---|---|---|---|
| `projectName` | `string` | `"GoodGirl QA Project"` | Friendly project display name |
| `baseURL` | `string` | `"http://127.0.0.1:4173"` | Default base URL for relative navigation and API requests |
| `browser` | `"chromium"` \| `"firefox"` \| `"webkit"` | `"chromium"` | Default browser engine for E2E tests |
| `timeout` | `number` | `30000` | Per-test timeout in milliseconds |
| `retries` | `number` | `1` | Retry attempts for failed tests |
| `screenshots` | `"off"` \| `"on"` \| `"only-on-failure"` | `"only-on-failure"` | Screenshot capture policy |
| `trace` | `"off"` \| `"on"` \| `"retain-on-failure"` \| `"on-first-retry"` | `"retain-on-failure"` | Playwright trace capture policy |
| `testDir` | `string` | `"tests"` | Directory containing test specifications |
| `resultsDir` | `string` | `"goodgirl-results"` | Target directory for generated reports and artifacts |

### Environment Variables & Secrets

Sensitive credentials and dynamic target URLs should never be hardcoded into configuration files. GoodGirl supports environment variable overrides:

| Variable | Description |
|---|---|
| `GOODGIRL_BASE_URL` | Overrides `baseURL` (e.g. `http://localhost:3000` or staging URL) |
| `GOODGIRL_BROWSER` | Overrides `browser` (`chromium`, `firefox`, `webkit`) |
| `GOODGIRL_TIMEOUT` | Overrides test timeout in milliseconds (e.g. `60000`) |
| `GOODGIRL_RETRIES` | Overrides retry count (e.g. `0` for fast local runs, `2` for CI) |

**Windows (PowerShell) Environment Example:**
```powershell
$env:GOODGIRL_BASE_URL = "http://127.0.0.1:8080"
pnpm qa test all
Remove-Item Env:\GOODGIRL_BASE_URL
```

**macOS / Linux Environment Example:**
```bash
GOODGIRL_BASE_URL="http://127.0.0.1:8080" pnpm qa test all
```

---

## Creating and Running Tests

### Testing Against the Built-in Fixture Application
By default, when `baseURL` points to port `4173` (e.g. `http://127.0.0.1:4173`), GoodGirl automatically boots its built-in hermetic HTTP test server. This allows you to verify browser interaction and API contract validation immediately without starting any external backend or database.

### Testing a Real External Application
To test your actual web application or API:
1. Set `baseURL` in `goodgirl.config.ts` (or via `GOODGIRL_BASE_URL`) to your running application:
   ```typescript
   export default {
     baseURL: "http://localhost:3000",
   };
   ```
2. Create test files using standard Playwright syntax under `tests/e2e/` and `tests/api/`:

#### Example E2E Test (`tests/e2e/login.spec.ts`)
```typescript
import { test, expect } from "@playwright/test";

test.describe("Authentication Journey", () => {
  test("user can log in successfully", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("qa-tester@example.com");
    await page.locator("#password").fill("Secret123!");
    await page.locator("button[type=submit]").click();

    await expect(page.locator("h1")).toHaveText("Dashboard");
  });
});
```

#### Example API Test (`tests/api/users.spec.ts`)
```typescript
import { test, expect } from "@playwright/test";

test.describe("Users API Contract", () => {
  test("GET /api/users returns 200 with user records", async ({ request }) => {
    const response = await request.get("/api/users");
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty("id");
  });
});
```

---

## Test Reporting and Artifacts

Every test execution generates reports under `goodgirl-results/` (automatically gitignored):

```
goodgirl-results/
├── html/             # Self-contained native Playwright HTML report
│   └── index.html
└── results.json      # Machine-readable JSON report with full execution telemetry
```

### Terminal Summary
After every test run, GoodGirl prints a clean, formatted terminal summary:

```
────────────────────────────────────────────────────────
 GoodGirl Test Execution Summary
────────────────────────────────────────────────────────
  Overall Status:  ✔ PASSED
  Total Tests:     6
  Passed:          6
  Failed:          0
  Skipped:         0
  Duration:        702ms
  HTML Report:     /Users/loyd/goodgirl/goodgirl-results/html
  JSON Report:     /Users/loyd/goodgirl/goodgirl-results/results.json
────────────────────────────────────────────────────────
```

### Viewing HTML Report
- Run `pnpm qa report --format html` to print the clickable URL (`file:///.../index.html`).
- Or open with Playwright: `pnpm exec playwright show-report goodgirl-results/html`.

### Consuming JSON Report
- Run `pnpm qa report --format json` to pipe structured JSON to stdout for CI/CD pipelines or metric aggregators.

---

## Monorepo Architecture

GoodGirl uses pnpm Workspaces with Turborepo for strict boundary enforcement and deterministic builds:

- **`apps/cli` (`@goodgirl/cli`)**: Commander.js CLI entry point, `@clack/prompts` interactive terminal interface, and command routing.
- **`packages/core` (`@goodgirl/core`)**: Test runner orchestrator, Jiti TypeScript configuration loader, Zod schema validator, and system diagnostics (`doctor`).
- **`packages/playwright` (`@goodgirl/playwright`)**: Playwright configuration factory, suite project mappings (`e2e` vs `api`), and hermetic Node.js fixture server.
- **`packages/reporter` (`@goodgirl/reporter`)**: Playwright JSON artifact parser and ANSI terminal summary formatter.
- **`packages/shared` (`@goodgirl/shared`)**: Shared TypeScript types, path normalization helpers, constants, and custom error classes.
- **`examples/sample-project`**: Working standalone sample QA project demonstrating external config loading and test execution.

---

## Development Scripts

Root `package.json` provides scripts to manage the workspace:

| Script | Command | Purpose |
|---|---|---|
| `pnpm build` | `turbo run build` | Builds all packages (`tsup`) with declaration generation |
| `pnpm dev` | `turbo run dev` | Runs build watchers across all workspaces |
| `pnpm lint` | `eslint .` | Verifies code quality and formatting rules with ESLint 9 |
| `pnpm typecheck` | `turbo run typecheck` | Validates strict TypeScript types across all workspaces |
| `pnpm test` | `turbo run test:unit` | Runs all Vitest unit tests |
| `pnpm qa` | `node ./scripts/qa.mjs` | Runs GoodGirl CLI directly without global installation |

---

## Troubleshooting

### 1. `Cannot resolve @playwright/test` or `playwright: command not found`
- **Cause**: Browser binaries or dependencies have not been installed yet.
- **Resolution**:
  ```bash
  pnpm install --frozen-lockfile
  pnpm exec playwright install chromium
  ```

### 2. Node.js Version Warning
- **Cause**: GoodGirl requires Node.js 22 or later.
- **Resolution**: Run `node -v` to check your runtime. Upgrade to Node.js 22.x or 24.x using your preferred version manager (`nvm`, `volta`, `fnm`, or official installer).

### 3. Port `4173` Already in Use
- **Cause**: Another local process is listening on the default fixture server port.
- **Resolution**: Specify a different target port or URL in `goodgirl.config.ts` or set `$env:GOODGIRL_BASE_URL = "http://127.0.0.1:4174"`.

### 4. Interactive Menu Not Responding in CI
- **Cause**: `@clack/prompts` requires an interactive terminal (TTY).
- **Resolution**: In automated CI/CD environments, always specify explicit CLI arguments (e.g. `pnpm qa test all` or `pnpm qa doctor`).

---

## Future Roadmap

The following modules are planned for future phases:

- **Phase 2 — Performance Testing**: Grafana k6 runner integration with authorized target verification and performance thresholds.
- **Phase 2 — Security Baseline Scanning**: OWASP ZAP baseline scanner integration with safe target authorization defaults.
- **Phase 2 — Historical Run Tracking**: Lightweight local SQLite result persistence to track test execution duration and flakiness across runs.
- **Phase 3 — Extended Reporters**: Automated Slack/Teams webhook reporting and formatted GitHub pull request comment summaries.

---

## Contributing / Development Guidance

See [CONTRIBUTING.md](file:///Users/loyd/goodgirl/CONTRIBUTING.md) for full contribution standards, cross-platform rules, and commit message guidelines.

---

## License Status

License decision is currently pending.
