import * as p from "@clack/prompts";
import pc from "picocolors";
import { executeTestCommand } from "../commands/test.js";
import { executeReportCommand } from "../commands/report.js";
import { executeDoctorCommand } from "../commands/doctor.js";
import { executeLoadDoctorCommand, executeLoadRunCommand } from "../commands/load.js";
import { executeSecurityBaselineCommand, executeSecurityDoctorCommand } from "../commands/security.js";

export async function runInteractiveMenu(): Promise<number> {
  p.intro(pc.bold(pc.cyan("GoodGirl CLI — Interactive QA Menu")));

  const action = await p.select({
    message: "Select an action:",
    options: [
      { value: "run-e2e", label: "Run E2E Tests", hint: "Execute end-to-end browser tests" },
      { value: "run-api", label: "Run API Tests", hint: "Execute API endpoint test suite" },
      { value: "run-all", label: "Run All Tests", hint: "Execute full E2E and API test suite" },
      { value: "load-smoke", label: "Run k6 Load Test", hint: "Execute k6 performance smoke workload" },
      { value: "security-baseline", label: "Run ZAP Security Scan", hint: "Execute baseline passive security scan" },
      { value: "report", label: "Generate Report", hint: "View latest HTML or JSON test report" },
      { value: "doctor", label: "Check Environment", hint: "Validate Playwright & system prerequisites" },
      { value: "load-doctor", label: "Check k6 Performance Engine", hint: "Validate Grafana k6 installation & capabilities" },
      { value: "security-doctor", label: "Check OWASP ZAP Engine", hint: "Validate OWASP ZAP installation, Docker, and status" },
      { value: "exit", label: "Exit", hint: "Close GoodGirl CLI" },
    ],
  });

  if (p.isCancel(action) || action === "exit") {
    p.outro(pc.dim("Goodbye!"));
    return 0;
  }

  if (action === "run-e2e") {
    return await executeTestCommand("e2e");
  }

  if (action === "run-api") {
    return await executeTestCommand("api");
  }

  if (action === "run-all") {
    return await executeTestCommand("all");
  }

  if (action === "load-smoke") {
    return await executeLoadRunCommand("examples/k6/smoke.js");
  }

  if (action === "security-baseline") {
    return await executeSecurityBaselineCommand();
  }

  if (action === "doctor") {
    return await executeDoctorCommand();
  }

  if (action === "load-doctor") {
    return await executeLoadDoctorCommand();
  }

  if (action === "security-doctor") {
    return await executeSecurityDoctorCommand();
  }

  if (action === "report") {
    const format = await p.select({
      message: "Select report format:",
      options: [
        { value: "html", label: "HTML Report", hint: "Browser-based interactive test report" },
        { value: "json", label: "JSON Report", hint: "Machine-readable test result payload" },
      ],
    });

    if (p.isCancel(format)) {
      p.outro(pc.dim("Operation canceled."));
      return 0;
    }

    return await executeReportCommand({ format: format as "html" | "json" });
  }

  return 0;
}
