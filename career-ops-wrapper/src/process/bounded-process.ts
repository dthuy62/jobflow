import { spawn, type ChildProcess } from "node:child_process";

export type StdoutMode =
  /** Keep the last `maxChars`; older output is dropped. */
  | { readonly kind: "tail"; readonly maxChars: number }
  /** Keep everything; past `maxChars` the process is killed and `outputTooLarge` is set. */
  | { readonly kind: "whole"; readonly maxChars: number };

export interface BoundedProcessInput {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  /** Aborting terminates the process group. */
  readonly signal?: AbortSignal;
  /** Written to stdin, which is then closed. stdin is ignored when absent. */
  readonly stdin?: string;
  readonly stdoutMode?: StdoutMode;
  readonly killGraceMs?: number;
}

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
  readonly spawnFailed: boolean;
  readonly outputTooLarge: boolean;
  /** Raw; never returned to clients. */
  readonly stdout: string;
  /** Tail of stderr, at most {@link PROCESS_OUTPUT_TAIL_CHARS}. Raw; never returned to clients. */
  readonly stderr: string;
}

export const PROCESS_OUTPUT_TAIL_CHARS = 256 * 1024;

const DEFAULT_KILL_GRACE_MS = 5000;
/** How long to wait for pipes to drain after exit before settling anyway. */
const PIPE_DRAIN_MS = 250;
const USE_PROCESS_GROUPS = process.platform !== "win32";

/** Processes still running in this wrapper process, killed if the wrapper exits. */
const liveProcesses = new Set<ChildProcess>();
process.once("exit", () => {
  for (const child of liveProcesses) {
    signalProcessGroup(child, "SIGKILL");
  }
});

/**
 * Runs a command with no shell, a timeout, abort support, and bounded output.
 * The child leads its own process group, so a timeout or abort also stops
 * grandchildren that hold the output pipes open.
 */
export function runBoundedProcess(input: BoundedProcessInput): Promise<ProcessResult> {
  const killGraceMs = input.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
  const stdoutMode = input.stdoutMode ?? { kind: "tail", maxChars: PROCESS_OUTPUT_TAIL_CHARS };

  if (input.signal?.aborted) {
    return Promise.resolve({
      exitCode: null,
      signal: "SIGTERM",
      timedOut: false,
      spawnFailed: false,
      outputTooLarge: false,
      stdout: "",
      stderr: ""
    });
  }

  return new Promise((resolve) => {
    const stdout = stdoutMode.kind === "tail" ? new OutputTail(stdoutMode.maxChars) : new WholeOutput();
    const stderr = new OutputTail(PROCESS_OUTPUT_TAIL_CHARS);
    let timedOut = false;
    let outputTooLarge = false;
    let settled = false;
    let killTimer: NodeJS.Timeout | undefined;
    let drainTimer: NodeJS.Timeout | undefined;

    const child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      env: input.env,
      shell: false,
      detached: USE_PROCESS_GROUPS,
      stdio: [input.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true
    });
    liveProcesses.add(child);

    const scheduleKill = (): void => {
      if (killTimer) {
        return;
      }
      signalProcessGroup(child, "SIGTERM");
      killTimer = setTimeout(() => signalProcessGroup(child, "SIGKILL"), killGraceMs).unref();
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      scheduleKill();
    }, input.timeoutMs);
    const onAbort = (): void => scheduleKill();
    input.signal?.addEventListener("abort", onAbort, { once: true });

    const finish = (result: Pick<ProcessResult, "exitCode" | "signal" | "spawnFailed">): void => {
      if (settled) {
        return;
      }
      settled = true;
      liveProcesses.delete(child);
      input.signal?.removeEventListener("abort", onAbort);
      clearTimeout(timeoutTimer);
      clearTimeout(killTimer);
      clearTimeout(drainTimer);
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve({
        ...result,
        exitCode: timedOut ? null : result.exitCode,
        timedOut,
        outputTooLarge,
        stdout: stdout.value(),
        stderr: stderr.value()
      });
    };

    if (input.stdin !== undefined && child.stdin) {
      // A child that exits without reading stdin closes the pipe; that is not an error here.
      child.stdin.on("error", () => undefined);
      child.stdin.end(input.stdin, "utf8");
    }

    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      if (outputTooLarge) {
        return;
      }
      stdout.append(chunk);
      if (stdoutMode.kind === "whole" && stdout.length() > stdoutMode.maxChars) {
        outputTooLarge = true;
        scheduleKill();
      }
    });
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => stderr.append(chunk));
    child.on("error", () => finish({ exitCode: null, signal: null, spawnFailed: true }));
    child.on("exit", (exitCode, signal) => {
      // Stop any surviving grandchildren, then give the pipes a moment to drain.
      signalProcessGroup(child, "SIGKILL");
      drainTimer = setTimeout(() => finish({ exitCode, signal, spawnFailed: false }), PIPE_DRAIN_MS);
    });
    child.on("close", (exitCode, signal) => finish({ exitCode, signal, spawnFailed: false }));
  });
}

function signalProcessGroup(child: ChildProcess, signal: NodeJS.Signals): void {
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

class OutputTail {
  private buffer = "";

  constructor(private readonly maxChars: number) {}

  append(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > this.maxChars * 2) {
      this.buffer = this.buffer.slice(-this.maxChars);
    }
  }

  length(): number {
    return this.buffer.length;
  }

  value(): string {
    return this.buffer.slice(-this.maxChars);
  }
}

class WholeOutput {
  private readonly chunks: string[] = [];
  private size = 0;

  append(chunk: string): void {
    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  length(): number {
    return this.size;
  }

  value(): string {
    return this.chunks.join("");
  }
}
