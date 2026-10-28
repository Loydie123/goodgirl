# GoodGirl CLI — Independent Black-Box QA Lab

This template sets up two completely independent folders **outside** the GoodGirl repository so you can test how GoodGirl CLI works against a separate application (Black-Box E2E, API, k6 Load Testing, and OWASP ZAP Security Scanning).

---

## 1. Scaffold the Black-Box Lab

From the root of the `goodgirl` repository, run:

**macOS / Linux:**
```bash
node examples/black-box/setup.mjs /tmp/goodgirl-qa-lab
```

**Windows (PowerShell):**
```powershell
node examples/black-box/setup.mjs C:\QA-Lab
```

This creates two folders inside your destination directory:
- `target/` — A standalone Node.js web & API server (`http://127.0.0.1:4387`)
- `qa/` — An independent QA project with Playwright tests (`tests/`), a k6 load script (`smoke.js`), and an OpenAPI spec (`openapi.json`)

---

## 2. Start the Target Application

Open **Terminal 1** and start the target server:

```bash
cd /tmp/goodgirl-qa-lab/target
node server.mjs
# Output: READY 4387
```

---

## 3. Install QA Project Dependencies

Open **Terminal 2**, go to the `qa/` folder, and install Playwright:

```bash
cd /tmp/goodgirl-qa-lab/qa
pnpm install
pnpm exec playwright install chromium firefox webkit
```

---

## 4. Run All QA Disciplines from the `qa/` Folder

Assuming `goodgirl` is built in your GoodGirl repo (or linked globally via `pnpm link --global`), run:

```bash
# 1. Environment Diagnostics
node /path/to/goodgirl/apps/cli/dist/index.js doctor
node /path/to/goodgirl/apps/cli/dist/index.js load doctor
node /path/to/goodgirl/apps/cli/dist/index.js security doctor

# 2. Functional E2E & REST API Tests (Playwright)
node /path/to/goodgirl/apps/cli/dist/index.js test all

# 3. Performance & Load Testing (Grafana k6)
node /path/to/goodgirl/apps/cli/dist/index.js load run smoke.js
node /path/to/goodgirl/apps/cli/dist/index.js load run smoke.js --vus 10 --duration 10s

# 4. Security Scanning (OWASP ZAP)
node /path/to/goodgirl/apps/cli/dist/index.js security baseline --target http://127.0.0.1:4387
node /path/to/goodgirl/apps/cli/dist/index.js security api openapi.json --target http://127.0.0.1:4387
```
