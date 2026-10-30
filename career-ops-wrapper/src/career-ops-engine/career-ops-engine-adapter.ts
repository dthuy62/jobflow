import { spawn } from "node:child_process";
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
}

export interface ScanProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly spawnFailed: boolean;
  /** Tail of stdout, at most {@link SCAN_OUTPUT_MAX_CHARS}. Not redacted. */
  readonly stdout: string;
  /** Tail of stderr, at most {@link SCAN_OUTPUT_MAX_CHARS}. Not redacted. */
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

  return {
    async runScan(input: RunScanInput): Promise<ScanProcessResult> {
      const scriptPath = await resolveWorkspaceRelativePath(workspacePath, SCAN_SCRIPT);
      const cwd = await resolveWorkspaceRoot(workspacePath);

      return new Promise((resolve) => {
        const stdout = new OutputTail();
        const stderr = new OutputTail();
        let timedOut = false;
        let settled = false;
        let killTimer: NodeJS.Timeout | undefined;

        const child = spawn(process.execPath, [scriptPath, ...buildScanArgv(input.args)], {
          cwd,
          env: childEnvironment(),
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        });

        const timeoutTimer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          killTimer = setTimeout(() => child.kill("SIGKILL"), killGraceMs);
        }, input.timeoutMs);

        const finish = (result: Omit<ScanProcessResult, "stdout" | "stderr" | "timedOut">): void => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutTimer);
          clearTimeout(killTimer);
          resolve({ ...result, timedOut, stdout: stdout.value(), stderr: stderr.value() });
        };

        child.stdout.setEncoding("utf8").on("data", (chunk: string) => stdout.append(chunk));
        child.stderr.setEncoding("utf8").on("data", (chunk: string) => stderr.append(chunk));
        child.on("error", () => finish({ exitCode: null, signal: null, spawnFailed: true }));
        child.on("close", (exitCode, signal) =>
          finish({ exitCode: timedOut ? null : exitCode, signal, spawnFailed: false })
        );
      });
    }
  };
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
