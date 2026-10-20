import pc from "picocolors";
import { scaffoldProject } from "@goodgirl/core";

export interface CliInitOptions {
  force?: boolean;
}

export async function executeInitCommand(options: CliInitOptions = {}): Promise<number> {
  console.log(pc.cyan("\n📦 Initializing GoodGirl QA project...\n"));

  try {
    const result = scaffoldProject({
      cwd: process.cwd(),
      force: options.force,
    });

    for (const file of result.createdFiles) {
      console.log(`  ${pc.green("✔ Created:")} ${file}`);
    }

    for (const skipped of result.skippedFiles) {
      console.log(`  ${pc.yellow("⚠ Skipped:")} ${skipped}`);
    }

    console.log(
      pc.green(
        pc.bold(
          `\n✨ Project successfully initialized! You can now run:\n` +
            `   ${pc.cyan("goodgirl test all")}   to run tests\n` +
            `   ${pc.cyan("goodgirl doctor")}     to check environment\n`,
        ),
      ),
    );

    return 0;
  } catch (err) {
    console.error(pc.red(`\n✖ Init failed: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}
