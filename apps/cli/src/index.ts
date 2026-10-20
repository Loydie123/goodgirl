import { Command } from "commander";
import pc from "picocolors";
import { executeTestCommand } from "./commands/test.js";
import { executeReportCommand } from "./commands/report.js";
import { executeDoctorCommand } from "./commands/doctor.js";
import { executeInitCommand } from "./commands/init.js";
import { runInteractiveMenu } from "./utils/menu.js";
import { printBanner } from "./utils/banner.js";

const program = new Command();

program
  .name("goodgirl")
  .description("GoodGirl CLI — All-in-One QA Automation Toolkit")
  .version("0.1.0");

// Command: goodgirl init
program
  .command("init")
  .description("Initialize a new GoodGirl QA project configuration and starter tests")
  .option("-f, --force", "Overwrite existing files if present", false)
  .action(async (opts: { force?: boolean }) => {
    const code = await executeInitCommand({ force: opts.force });
    process.exit(code);
  });

// Command: goodgirl test <e2e|api|all>
const testCmd = program
  .command("test")
  .description("Run test suites (e2e, api, all)");

testCmd
  .command("e2e")
  .description("Execute end-to-end browser tests")
  .option("--headed", "Run browsers in headed mode (visible UI)", false)
  .option("--grep <pattern>", "Filter tests by pattern or tag")
  .option("-c, --config <path>", "Custom configuration file path")
  .action(async (opts: { headed?: boolean; grep?: string; config?: string }) => {
    const code = await executeTestCommand("e2e", opts);
    process.exit(code);
  });

testCmd
  .command("api")
  .description("Execute API test suite")
  .option("--grep <pattern>", "Filter tests by pattern or tag")
  .option("-c, --config <path>", "Custom configuration file path")
  .action(async (opts: { grep?: string; config?: string }) => {
    const code = await executeTestCommand("api", opts);
    process.exit(code);
  });

testCmd
  .command("all")
  .description("Execute all test suites (both E2E and API)")
  .option("--headed", "Run browsers in headed mode (visible UI)", false)
  .option("--grep <pattern>", "Filter tests by pattern or tag")
  .option("-c, --config <path>", "Custom configuration file path")
  .action(async (opts: { headed?: boolean; grep?: string; config?: string }) => {
    const code = await executeTestCommand("all", opts);
    process.exit(code);
  });

// Command: goodgirl report
program
  .command("report")
  .description("Display or inspect test execution reports")
  .option("-f, --format <format>", "Report format (html | json)", "html")
  .option("-c, --config <path>", "Custom configuration file path")
  .action(async (opts: { format?: string; config?: string }) => {
    const code = await executeReportCommand(opts);
    process.exit(code);
  });

// Command: goodgirl doctor
program
  .command("doctor")
  .description("Run environment and configuration diagnostics")
  .action(async () => {
    const code = await executeDoctorCommand();
    process.exit(code);
  });

async function main() {
  const args = process.argv.slice(2);

  // If launched with no arguments, launch interactive terminal menu
  if (args.length === 0) {
    printBanner();
    try {
      const code = await runInteractiveMenu();
      process.exit(code);
    } catch (err) {
      console.error(pc.red(`\n✖ Interactive menu error: ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  }

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(pc.red(`\n✖ Command error: ${err instanceof Error ? err.message : String(err)}\n`));
    process.exit(1);
  }
}

main();
