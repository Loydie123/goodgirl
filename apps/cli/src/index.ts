import { Command } from "commander";
import pc from "picocolors";
import { executeTestCommand, type CliTestOptions } from "./commands/test.js";
import { executeReportCommand } from "./commands/report.js";
import { executeDoctorCommand } from "./commands/doctor.js";
import { executeInitCommand } from "./commands/init.js";
import { executeTraceCommand } from "./commands/trace.js";
import { executeCodegenCommand } from "./commands/codegen.js";
import { runInteractiveMenu } from "./utils/menu.js";
import { printBanner } from "./utils/banner.js";

const program = new Command();

program
  .name("goodgirl")
  .description("GoodGirl CLI — All-in-One QA Automation Toolkit")
  .version("0.1.0");

function getPassthroughArgs(): string[] {
  const dashDashIdx = process.argv.indexOf("--");
  if (dashDashIdx !== -1) {
    return process.argv.slice(dashDashIdx + 1);
  }
  return [];
}

function separateFilesAndPassthrough(rawFiles: string[] = []): string[] {
  const dashDashIdx = process.argv.indexOf("--");
  if (dashDashIdx === -1) return rawFiles;
  return rawFiles.filter((f) => {
    const idx = process.argv.indexOf(f);
    return idx !== -1 && idx < dashDashIdx;
  });
}

function applyTestOptions(cmd: Command): Command {
  return cmd
    .argument("[files...]", "Specific test files or directories to run")
    .option("-b, --browser <browser>", "Browser engine (chromium, firefox, webkit, all)")
    .option("-p, --project <project>", "Run specific Playwright project or device preset")
    .option("--headed", "Run browsers in headed mode (visible UI)", false)
    .option("-w, --workers <count>", "Parallel worker count or percentage (e.g. 4 or 50%)")
    .option("--retries <count>", "Maximum retries for failing tests")
    .option("--timeout <ms>", "Test timeout in milliseconds")
    .option("--grep <pattern>", "Filter tests by title regex pattern or tag")
    .option("--grep-invert <pattern>", "Invert test filter regex pattern")
    .option("--shard <shard>", "Shard test execution (e.g. 1/4)")
    .option("--repeat-each <count>", "Repeat each test N times")
    .option("--max-failures <count>", "Stop after N test failures")
    .option("--last-failed", "Only run tests that failed in previous run", false)
    .option("--list", "List tests without running them", false)
    .option("--debug", "Run tests with Playwright Inspector step debugger", false)
    .option("--ui", "Open interactive Playwright UI mode", false)
    .option("--trace <mode>", "Trace recording mode (off, on, retain-on-failure, on-first-retry)")
    .option("--video <mode>", "Video recording mode (off, on, retain-on-failure, on-first-retry)")
    .option("-c, --config <path>", "Custom configuration file path");
}

async function handleTestRun(
  type: "e2e" | "api" | "all",
  rawFiles: string[],
  options: CliTestOptions,
) {
  const files = separateFilesAndPassthrough(rawFiles);
  const passthroughArgs = getPassthroughArgs();
  const code = await executeTestCommand(type, files, {
    ...options,
    passthroughArgs: passthroughArgs.length > 0 ? passthroughArgs : undefined,
  });
  process.exit(code);
}

// Command: goodgirl init
program
  .command("init")
  .description("Initialize a new GoodGirl QA project configuration and starter tests")
  .option("-f, --force", "Overwrite existing files if present", false)
  .action(async (opts: { force?: boolean }) => {
    const code = await executeInitCommand({ force: opts.force });
    process.exit(code);
  });

// Command: goodgirl test [files...]
const testCmd = program
  .command("test")
  .description("Run test suites (e2e, api, all)");

applyTestOptions(testCmd)
  .action(async (files: string[], opts: CliTestOptions) => {
    await handleTestRun("all", files, opts);
  });

applyTestOptions(
  testCmd
    .command("e2e")
    .description("Execute end-to-end browser tests")
).action(async (files: string[], opts: CliTestOptions) => {
  await handleTestRun("e2e", files, opts);
});

applyTestOptions(
  testCmd
    .command("api")
    .description("Execute API test suite")
).action(async (files: string[], opts: CliTestOptions) => {
  await handleTestRun("api", files, opts);
});

applyTestOptions(
  testCmd
    .command("all")
    .description("Execute all test suites (both E2E and API)")
).action(async (files: string[], opts: CliTestOptions) => {
  await handleTestRun("all", files, opts);
});

// Command: goodgirl report
program
  .command("report")
  .description("Display or inspect test execution reports")
  .option("-f, --format <format>", "Report format (html | json)", "html")
  .option("-o, --open", "Open interactive HTML report in browser viewer", false)
  .option("-c, --config <path>", "Custom configuration file path")
  .action(async (opts: { format?: string; open?: boolean; config?: string }) => {
    const code = await executeReportCommand(opts);
    process.exit(code);
  });

// Command: goodgirl trace [trace-path]
program
  .command("trace")
  .description("Open Playwright Trace Viewer for inspection")
  .argument("[trace-path]", "Path to a trace.zip file (defaults to most recent trace)")
  .action(async (tracePath?: string) => {
    const code = await executeTraceCommand(tracePath);
    process.exit(code);
  });

// Command: goodgirl codegen [url]
program
  .command("codegen")
  .description("Launch Playwright Codegen to record browser actions and generate tests")
  .argument("[url]", "Initial URL to open in browser")
  .option("-b, --browser <browser>", "Browser engine to use (chromium, firefox, webkit)")
  .option("--device <device>", "Emulate a specific device (e.g. 'iPhone 13')")
  .option("-o, --output <file>", "Save generated script to a file")
  .action(async (url: string | undefined, opts: { browser?: string; device?: string; output?: string }) => {
    const code = await executeCodegenCommand(url, opts);
    process.exit(code);
  });

// Command: goodgirl doctor
program
  .command("doctor")
  .description("Run environment, browser binaries, and configuration diagnostics")
  .option("-c, --config <path>", "Custom configuration file path")
  .action(async (opts: { config?: string }) => {
    const code = await executeDoctorCommand(opts);
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
