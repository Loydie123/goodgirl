import pc from "picocolors";
import { runTests } from "@goodgirl/core";
import { printTerminalSummary } from "@goodgirl/reporter";
import type { TestRunOptions, TestType } from "@goodgirl/shared";

export interface CliTestOptions {
  headed?: boolean;
  grep?: string;
  config?: string;
}

export async function executeTestCommand(
  type: TestType,
  options: CliTestOptions = {},
): Promise<number> {
  console.log(
    pc.cyan(
      `\n🚀 Starting GoodGirl ${type.toUpperCase()} test suite${options.headed ? " (headed mode)" : ""}${options.grep ? ` [grep: "${options.grep}"]` : ""}...\n`,
    ),
  );

  const runOptions: TestRunOptions = {
    type,
    headed: options.headed,
    grep: options.grep,
    configPath: options.config,
    cwd: process.cwd(),
  };

  try {
    const { summary, subprocess } = await runTests(runOptions);

    // Print normalized terminal summary
    printTerminalSummary(summary);

    if (!summary.success || subprocess.exitCode !== 0) {
      return subprocess.exitCode !== 0 ? subprocess.exitCode : 1;
    }
    return 0;
  } catch (err) {
    console.error(pc.red(`\n✖ Test execution error: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}
