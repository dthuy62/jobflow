import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runBoundedProcess } from "../src/process/bounded-process.js";

const node = process.execPath;

function run(script: string, extra: Partial<Parameters<typeof runBoundedProcess>[0]> = {}) {
  return runBoundedProcess({
    command: node,
    args: ["-e", script],
    cwd: tmpdir(),
    env: { PATH: process.env.PATH ?? "" },
    timeoutMs: 10_000,
    killGraceMs: 200,
    ...extra
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("runBoundedProcess", () => {
  it("writes stdin to the child and closes it", async () => {
    const result = await run("process.stdin.pipe(process.stdout)", { stdin: "hello from stdin" });

    expect(result).toMatchObject({ exitCode: 0, spawnFailed: false, timedOut: false, outputTooLarge: false });
    expect(result.stdout).toBe("hello from stdin");
  });

  it("keeps whole stdout below the cap", async () => {
    const result = await run("process.stdout.write('x'.repeat(300000))", {
      stdoutMode: { kind: "whole", maxChars: 400_000 }
    });

    expect(result.outputTooLarge).toBe(false);
    expect(result.stdout).toHaveLength(300_000);
  });

  it("kills the child and flags it when whole stdout passes the cap", async () => {
    const result = await run("setInterval(() => process.stdout.write('y'.repeat(65536)), 1)", {
      stdoutMode: { kind: "whole", maxChars: 100_000 }
    });

    expect(result.outputTooLarge).toBe(true);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout.length).toBeLessThanOrEqual(100_000 + 65_536);
  });

  it("kills the whole process group on timeout", async () => {
    const result = await run(
      "const c = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); console.log(c.pid); setInterval(() => {}, 1000);",
      { timeoutMs: 500 }
    );

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
    const grandchild = Number(result.stdout.trim());
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(isAlive(grandchild)).toBe(false);
  });

  it("stops the child when aborted", async () => {
    const controller = new AbortController();
    const pending = run("setInterval(() => {}, 1000)", { signal: controller.signal });
    setTimeout(() => controller.abort(), 100);

    const result = await pending;

    expect(result.timedOut).toBe(false);
    expect(result.signal).toBe("SIGTERM");
  });

  it("reports a command that cannot be started", async () => {
    const result = await runBoundedProcess({
      command: "/nonexistent/jobflow-cli",
      args: [],
      cwd: tmpdir(),
      env: {},
      timeoutMs: 1000
    });

    expect(result.spawnFailed).toBe(true);
  });
});
