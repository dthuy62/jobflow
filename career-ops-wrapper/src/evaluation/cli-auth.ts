import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runBoundedProcess } from "../process/bounded-process.js";
import { CLAUDE_AUTH_STATUS_ARGV, buildChildEnv } from "./claude-command.js";

export type CliAuthState = "logged-in" | "logged-out" | "check-failed";

export interface CliAuthChecker {
  /** Cached for {@link CLI_AUTH_CACHE_MS}; `fresh` skips the cache. Concurrent callers share one check. */
  check(fresh?: boolean): Promise<CliAuthState>;
}

export const CLI_AUTH_CACHE_MS = 60_000;
const CLI_AUTH_TIMEOUT_MS = 10_000;

export function createCliAuthChecker(
  cliPath: string,
  options: { readonly now?: () => number; readonly cacheMs?: number } = {}
): CliAuthChecker {
  const now = options.now ?? Date.now;
  const cacheMs = options.cacheMs ?? CLI_AUTH_CACHE_MS;
  let cached: { state: CliAuthState; at: number } | undefined;
  let inFlight: Promise<CliAuthState> | undefined;

  const run = (): Promise<CliAuthState> => {
    inFlight ??= readAuthState(cliPath)
      .then((state) => {
        cached = { state, at: now() };
        return state;
      })
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };

  return {
    async check(fresh = false): Promise<CliAuthState> {
      if (!fresh && cached && now() - cached.at < cacheMs) {
        return cached.state;
      }
      return run();
    }
  };
}

/** Reads only `loggedIn` from `claude auth status --json`; no account detail is kept. */
async function readAuthState(cliPath: string): Promise<CliAuthState> {
  const cwd = await mkdtemp(path.join(tmpdir(), "jobflow-auth-"));
  try {
    const result = await runBoundedProcess({
      command: cliPath,
      args: CLAUDE_AUTH_STATUS_ARGV,
      cwd,
      env: buildChildEnv(process.env),
      timeoutMs: CLI_AUTH_TIMEOUT_MS,
      stdoutMode: { kind: "whole", maxChars: 64 * 1024 }
    });
    if (result.spawnFailed || result.timedOut || result.outputTooLarge) {
      return "check-failed";
    }
    const loggedIn = parseLoggedIn(result.stdout);
    if (loggedIn === undefined) {
      return "check-failed";
    }
    return loggedIn ? "logged-in" : "logged-out";
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => undefined);
  }
}

function parseLoggedIn(stdout: string): boolean | undefined {
  try {
    const parsed: unknown = JSON.parse(stdout);
    const loggedIn = (parsed as { loggedIn?: unknown } | null)?.loggedIn;
    return typeof loggedIn === "boolean" ? loggedIn : undefined;
  } catch {
    return undefined;
  }
}
