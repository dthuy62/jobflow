import { spawn, type ChildProcess } from "node:child_process";
import { resolveWorkspaceRelativePath } from "../security/path-guard.js";
import { resolveWorkspaceRoot } from "../workspace/workspace-paths.js";

/** The only scan options the wrapper forwards to `scan.mjs`. */
export interface RunScanArgs {
  readonly dryRun: boolean;
  readonly company?: string;
}

export interface RunScanInput {
  readonly args: RunScanArgs;
  readonly timeoutMs: number;
  /** Aborting terminates the scan's process group (wrapper shutdown). */
  readonly signal?: AbortSignal;
}

export interface ScanProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly spawnFailed: boolean;
  /** Tail of stdout, at most {@link SCAN_OUTPUT_MAX_CHARS}. Raw; never returned to clients. */
  readonly stdout: string;
  /** Tail of stderr, at most {@link SCAN_OUTPUT_MAX_CHARS}. Raw; never returned to clients. */
  readonly stderr: string;
}

export interface CareerOpsEngineAdapter {
  runScan(input: RunScanInput): Promise<ScanProcessResult>;
}

export interface CareerOpsEngineAdapterOptions {
  readonly killGraceMs?: number;
}

export const SCAN_OUTPUT_MAX_CHARS = 256 * 1024;

const SCAN_SCRIPT = "scan.mjs";
const DEFAULT_KILL_GRACE_MS = 5000;
/** How long to wait for pipes to drain after exit before settling anyway. */
const PIPE_DRAIN_MS = 250;
const USE_PROCESS_GROUPS = process.platform !== "win32";

/** Scans still running in this wrapper process, killed if the wrapper exits. */
const liveScans = new Set<ChildProcess>();
process.once("exit", () => {
  for (const child of liveScans) {
    signalScan(child, "SIGKILL");
  }
});

export function buildScanArgv(args: RunScanArgs): string[] {
  return [
    ...(args.dryRun ? ["--dry-run"] : []),
    ...(args.company !== undefined ? ["--company", args.company] : [])
  ];
}

/**
 * Runs the workspace's `scan.mjs` with the current Node binary, no shell, an
 * allowlisted argv, a stripped environment, a timeout, and bounded output.
 */
export function createCareerOpsEngineAdapter(
  workspacePath: string,
  options: CareerOpsEngineAdapterOptions = {}
): CareerOpsEngineAdapter {
  const killGraceMs = options.killGraceMs ?? DEFAULT_KILL_GRACE_MS;

  const scheduleKill = (child: ChildProcess): NodeJS.Timeout => {
    signalScan(child, "SIGTERM");
    return setTimeout(() => signalScan(child, "SIGKILL"), killGraceMs).unref();
  };

  return {
    async runScan(input: RunScanInput): Promise<ScanProcessResult> {
      const scriptPath = await resolveWorkspaceRelativePath(workspacePath, SCAN_SCRIPT);
      const cwd = await resolveWorkspaceRoot(workspacePath);
      if (input.signal?.aborted) {
        return { exitCode: null, signal: "SIGTERM", timedOut: false, spawnFailed: false, stdout: "", stderr: "" };
      }

      return new Promise((resolve) => {
        const stdout = new OutputTail();
        const stderr = new OutputTail();
        let timedOut = false;
        let settled = false;
        let killTimer: NodeJS.Timeout | undefined;
        let drainTimer: NodeJS.Timeout | undefined;

        // A detached child leads its own process group, so a timeout or
        // shutdown can kill grandchildren that hold the output pipes open.
        const child = spawn(process.execPath, [scriptPath, ...buildScanArgv(input.args)], {
          cwd,
          env: childEnvironment(),
          shell: false,
          detached: USE_PROCESS_GROUPS,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        });
        liveScans.add(child);

        const timeoutTimer = setTimeout(() => {
          timedOut = true;
          killTimer = scheduleKill(child);
        }, input.timeoutMs);
        const onAbort = (): void => {
          killTimer = scheduleKill(child);
        };
        input.signal?.addEventListener("abort", onAbort, { once: true });

        const finish = (result: Omit<ScanProcessResult, "stdout" | "stderr" | "timedOut">): void => {
          if (settled) {
            return;
          }
          settled = true;
          liveScans.delete(child);
          input.signal?.removeEventListener("abort", onAbort);
          clearTimeout(timeoutTimer);
          clearTimeout(killTimer);
          clearTimeout(drainTimer);
          child.stdout?.destroy();
          child.stderr?.destroy();
          resolve({ ...result, timedOut, stdout: stdout.value(), stderr: stderr.value() });
        };

        child.stdout?.setEncoding("utf8").on("data", (chunk: string) => stdout.append(chunk));
        child.stderr?.setEncoding("utf8").on("data", (chunk: string) => stderr.append(chunk));
        child.on("error", () => finish({ exitCode: null, signal: null, spawnFailed: true }));
        child.on("exit", (exitCode, signal) => {
          // Stop any surviving grandchildren, then give the pipes a moment to drain.
          signalScan(child, "SIGKILL");
          drainTimer = setTimeout(
            () => finish({ exitCode: timedOut ? null : exitCode, signal, spawnFailed: false }),
            PIPE_DRAIN_MS
          );
        });
        child.on("close", (exitCode, signal) =>
          finish({ exitCode: timedOut ? null : exitCode, signal, spawnFailed: false })
        );
      });
    }
  };
}

function signalScan(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (USE_PROCESS_GROUPS && child.pid !== undefined) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    // The process group is already gone.
  }
}

function childEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("CAREER_OPS_"))
  );
}

class OutputTail {
  private buffer = "";

  append(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > SCAN_OUTPUT_MAX_CHARS * 2) {
      this.buffer = this.buffer.slice(-SCAN_OUTPUT_MAX_CHARS);
    }
  }

  value(): string {
    return this.buffer.slice(-SCAN_OUTPUT_MAX_CHARS);
  }
}
