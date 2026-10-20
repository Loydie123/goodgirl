import spawn from "cross-spawn";
import type { SpawnOptions } from "node:child_process";

export interface SubprocessResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  error?: Error;
}

export function runSubprocess(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<SubprocessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    const cleanupSignals = () => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
    };

    const onSignal = (sig: NodeJS.Signals) => {
      try {
        if (!child.killed) {
          child.kill(sig);
        }
      } catch {
        // Ignore errors during signal forwarding
      }
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    child.on("error", (error) => {
      cleanupSignals();
      resolve({
        exitCode: 1,
        signal: null,
        error,
      });
    });

    child.on("close", (code, signal) => {
      cleanupSignals();
      resolve({
        exitCode: code ?? (signal ? 1 : 0),
        signal,
      });
    });
  });
}
