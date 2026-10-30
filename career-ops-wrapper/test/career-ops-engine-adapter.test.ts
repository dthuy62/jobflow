import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildScanArgv,
  createCareerOpsEngineAdapter
} from "../src/career-ops-engine/career-ops-engine-adapter.js";

const workspaces: string[] = [];

async function workspaceWithScript(script: string): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "engine-adapter-"));
  workspaces.push(workspace);
  await writeFile(path.join(workspace, "scan.mjs"), script);
  return workspace;
}

afterEach(async () => {
  delete process.env.CAREER_OPS_PAIRING_TOKEN;
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("buildScanArgv", () => {
  it("maps only allowlisted options to separate argv elements", () => {
    expect(buildScanArgv({ dryRun: false })).toEqual([]);
    expect(buildScanArgv({ dryRun: true, company: "Acme; rm -rf /" })).toEqual([
      "--dry-run",
      "--company",
      "Acme; rm -rf /"
    ]);
  });
});

describe("CareerOpsEngineAdapter.runScan", () => {
  it("runs scan.mjs with node, without a shell, in the workspace", async () => {
    const workspace = await workspaceWithScript(
      "console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));"
    );

    const result = await createCareerOpsEngineAdapter(workspace).runScan({
      args: { dryRun: true, company: "Acme $(whoami)" },
      timeoutMs: 10_000
    });

    expect(result).toMatchObject({ exitCode: 0, timedOut: false, spawnFailed: false });
    const output = JSON.parse(result.stdout) as { args: string[]; cwd: string };
    expect(output.args).toEqual(["--dry-run", "--company", "Acme $(whoami)"]);
    expect(path.basename(output.cwd)).toBe(path.basename(workspace));
  });

  it("does not pass CAREER_OPS_* variables to the child", async () => {
    process.env.CAREER_OPS_PAIRING_TOKEN = "child-must-not-see";
    const workspace = await workspaceWithScript(
      "console.log(Object.keys(process.env).filter((key) => key.startsWith('CAREER_OPS')).join(','));"
    );

    const result = await createCareerOpsEngineAdapter(workspace).runScan({
      args: { dryRun: true },
      timeoutMs: 10_000
    });

    expect(result.stdout.trim()).toBe("");
  });

  it("reports non-zero exit codes and stderr", async () => {
    const workspace = await workspaceWithScript("console.error('Error: portals.yml not found'); process.exit(1);");

    const result = await createCareerOpsEngineAdapter(workspace).runScan({
      args: { dryRun: false },
      timeoutMs: 10_000
    });

    expect(result).toMatchObject({ exitCode: 1, timedOut: false });
    expect(result.stderr).toContain("portals.yml not found");
  });

  it("kills a scan that exceeds the timeout", async () => {
    const workspace = await workspaceWithScript("setInterval(() => {}, 1000);");

    const result = await createCareerOpsEngineAdapter(workspace, { killGraceMs: 200 }).runScan({
      args: { dryRun: true },
      timeoutMs: 200
    });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
  });

  it("finishes a timed-out scan even when a grandchild holds its pipes", async () => {
    const workspace = await workspaceWithScript(
      [
        "import { spawn } from 'node:child_process';",
        "spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });",
        "setInterval(() => {}, 1000);"
      ].join("\n")
    );
    const started = Date.now();

    const result = await createCareerOpsEngineAdapter(workspace, { killGraceMs: 200 }).runScan({
      args: { dryRun: true },
      timeoutMs: 300
    });

    expect(result.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("terminates a running scan when its signal aborts", async () => {
    const workspace = await workspaceWithScript("setInterval(() => {}, 1000);");
    const adapter = createCareerOpsEngineAdapter(workspace, { killGraceMs: 200 });
    const controller = new AbortController();

    const running = adapter.runScan({ args: { dryRun: true }, timeoutMs: 60_000, signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 200));
    controller.abort();
    const result = await running;

    expect(result.exitCode).toBeNull();
    expect(result.signal).toBe("SIGTERM");
  });

  it("keeps only the tail of very large output", async () => {
    const workspace = await workspaceWithScript(
      "process.stdout.write('a'.repeat(400 * 1024)); process.stdout.write('TAIL');"
    );

    const result = await createCareerOpsEngineAdapter(workspace).runScan({
      args: { dryRun: true },
      timeoutMs: 10_000
    });

    expect(result.stdout.length).toBe(256 * 1024);
    expect(result.stdout.endsWith("TAIL")).toBe(true);
  });

  it("rejects a missing scan script before spawning", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "engine-adapter-"));
    workspaces.push(workspace);

    await expect(
      createCareerOpsEngineAdapter(workspace).runScan({ args: { dryRun: true }, timeoutMs: 1000 })
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
  });
});
