import { runBoundedProcess, PROCESS_OUTPUT_TAIL_CHARS } from "../process/bounded-process.js";
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

export const SCAN_OUTPUT_MAX_CHARS = PROCESS_OUTPUT_TAIL_CHARS;

const SCAN_SCRIPT = "scan.mjs";

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
  return {
    async runScan(input: RunScanInput): Promise<ScanProcessResult> {
      const scriptPath = await resolveWorkspaceRelativePath(workspacePath, SCAN_SCRIPT);
      const cwd = await resolveWorkspaceRoot(workspacePath);
      const result = await runBoundedProcess({
        command: process.execPath,
        args: [scriptPath, ...buildScanArgv(input.args)],
        cwd,
        env: childEnvironment(),
        timeoutMs: input.timeoutMs,
        ...(input.signal ? { signal: input.signal } : {}),
        ...(options.killGraceMs !== undefined ? { killGraceMs: options.killGraceMs } : {})
      });
      return {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        spawnFailed: result.spawnFailed,
        stdout: result.stdout,
        stderr: result.stderr
      };
    }
  };
}

function childEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("CAREER_OPS_"))
  );
}
