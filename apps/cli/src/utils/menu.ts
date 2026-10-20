import * as p from "@clack/prompts";
import pc from "picocolors";
import { executeTestCommand } from "../commands/test.js";
import { executeReportCommand } from "../commands/report.js";
import { executeDoctorCommand } from "../commands/doctor.js";

export async function runInteractiveMenu(): Promise<number> {
  p.intro(pc.bold(pc.cyan("GoodGirl CLI — Interactive QA Menu")));

  const action = await p.select({
    message: "Select an action:",
    options: [
      { value: "run-e2e", label: "Run E2E Tests", hint: "Execute end-to-end browser tests" },
      { value: "run-api", label: "Run API Tests", hint: "Execute API endpoint test suite" },
      { value: "run-all", label: "Run All Tests", hint: "Execute full E2E and API test suite" },
      { value: "report", label: "Generate Report", hint: "View latest HTML or JSON test report" },
      { value: "doctor", label: "Check Environment", hint: "Validate system prerequisites & config" },
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

  if (action === "doctor") {
    return await executeDoctorCommand();
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
