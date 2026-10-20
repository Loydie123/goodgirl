import pc from "picocolors";
import { launchCodegen } from "@goodgirl/core";

export interface CliCodegenOptions {
  browser?: string;
  device?: string;
  output?: string;
}

export async function executeCodegenCommand(
  url?: string,
  options: CliCodegenOptions = {},
): Promise<number> {
  const targetDesc = url ? `for ${url}` : "";
  console.log(pc.cyan(`\n🎬 Launching Playwright Codegen ${targetDesc}...\n`));

  try {
    const result = await launchCodegen(url, {
      browser: options.browser,
      device: options.device,
      output: options.output,
      cwd: process.cwd(),
    });
    return result.exitCode;
  } catch (err) {
    console.error(pc.red(`\n✖ Failed to launch Codegen: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}
