import pc from "picocolors";
import { runDoctorChecks } from "@goodgirl/core";

export async function executeDoctorCommand(): Promise<number> {
  console.log(pc.cyan("\n🩺 Running GoodGirl Environment & Configuration Diagnostics...\n"));

  try {
    const report = await runDoctorChecks(process.cwd());

    for (const check of report.checks) {
      const icon =
        check.status === "pass"
          ? pc.green("✔")
          : check.status === "warn"
            ? pc.yellow("⚠")
            : pc.red("✖");

      console.log(`  ${icon} ${pc.bold(check.name)}: ${check.message}`);
      if (check.details) {
        console.log(`    ${pc.dim(check.details)}`);
      }
    }

    console.log();
    if (report.healthy) {
      console.log(pc.green(pc.bold("✨ All environment checks passed! System is ready for testing.\n")));
      return 0;
    }

    console.log(pc.red(pc.bold("✖ Diagnostics identified issues. Please resolve the errors above.\n")));
    return 1;
  } catch (err) {
    console.error(pc.red(`\n✖ Doctor execution failed: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}
