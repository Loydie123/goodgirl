import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { launchTraceViewer } from "@goodgirl/core";

function findTraceFiles(dir: string): string[] {
  const found: string[] = [];
  if (!existsSync(dir)) return found;

  function walk(current: string) {
    try {
      const entries = readdirSync(current);
      for (const entry of entries) {
        const full = join(current, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (entry.endsWith("trace.zip") || entry.endsWith(".zip")) {
          found.push(full);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  walk(dir);
  return found;
}

export async function executeTraceCommand(tracePath?: string): Promise<number> {
  const cwd = process.cwd();
  let resolvedTrace: string | undefined;

  if (tracePath) {
    resolvedTrace = resolve(cwd, tracePath);
    if (!existsSync(resolvedTrace)) {
      console.error(pc.red(`\n✖ Specified trace file not found: "${resolvedTrace}"\n`));
      return 1;
    }
  } else {
    // Attempt auto-discovery in standard results directories
    const candidateDirs = [
      resolve(cwd, "goodgirl-results"),
      resolve(cwd, "test-results"),
    ];
    let foundTraces: string[] = [];
    for (const d of candidateDirs) {
      foundTraces = foundTraces.concat(findTraceFiles(d));
    }

    if (foundTraces.length === 0) {
      console.error(
        pc.red(
          `\n✖ No trace archive (.zip) found. Run tests with \`--trace on\` or specify trace path:\n  pnpm qa trace <path-to-trace.zip>\n`,
        ),
      );
      return 1;
    }

    // Sort by modified time descending to pick the most recent trace
    foundTraces.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    resolvedTrace = foundTraces[0];
    console.log(pc.cyan(`\n🔍 Found recent trace archive: ${resolvedTrace}`));
  }

  if (!resolvedTrace) {
    console.error(pc.red("\n✖ No trace archive specified or discovered.\n"));
    return 1;
  }

  console.log(pc.cyan(`\n🎭 Launching Playwright Trace Viewer for: ${resolvedTrace}...\n`));

  try {
    const result = await launchTraceViewer(resolvedTrace, cwd);
    return result.exitCode;
  } catch (err) {
    console.error(pc.red(`\n✖ Failed to launch Trace Viewer: ${err instanceof Error ? err.message : String(err)}\n`));
    return 1;
  }
}
