import { access, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorResponseDtoSchema, ScanRunDtoSchema, type ScanRunDto } from "../src/contracts/index.js";
import { createServer } from "../src/server.js";
import { copyProjectionFixture, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];
const servers: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await removeWorkspaces(workspaces);
});

async function serverFor(workspace: string, extra: { scanTimeoutMs?: number; pairingToken?: string } = {}) {
  const server = await createServer({
    config: { host: "127.0.0.1", port: 3000, workspace, ...extra }
  });
  servers.push(server);
  return server;
}

async function fixtureWorkspace(): Promise<string> {
  const workspace = await copyProjectionFixture();
  workspaces.push(workspace);
  return workspace;
}

async function pollUntilDone(server: FastifyInstance, id: string): Promise<ScanRunDto> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await server.inject({ method: "GET", url: `/api/v1/scan-runs/${id}` });
    expect(response.statusCode).toBe(200);
    const run = ScanRunDtoSchema.parse(response.json());
    if (!run.active) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("scan run did not finish");
}

describe("scan run routes", () => {
  it("starts a scan, reports it running, and completes with summary counts", async () => {
    const workspace = await fixtureWorkspace();
    const server = await serverFor(workspace);

    const start = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });

    expect(start.statusCode).toBe(202);
    const started = ScanRunDtoSchema.parse(start.json());
    expect(started).toMatchObject({ status: "running", stage: "executing", active: true, finishedAt: null });
    expect(started.id).toMatch(/^scan_\d{14}_[a-f0-9]{6}$/);

    const finished = await pollUntilDone(server, started.id);
    expect(finished).toMatchObject({
      status: "succeeded",
      stage: "completed",
      active: false,
      exitCode: 0,
      failure: null,
      summary: {
        offersFound: 4,
        offersProjected: 1,
        warnings: ["Globex Labs: the careers page could not be fetched."]
      }
    });
    expect(finished.finishedAt).toEqual(expect.any(String));

    const latest = await server.inject({ method: "GET", url: "/api/v1/scan-runs/latest" });
    expect(latest.json()).toMatchObject({ id: started.id, status: "succeeded" });
  });

  it("forwards dryRun and company and projects nothing on a dry run", async () => {
    const workspace = await fixtureWorkspace();
    const server = await serverFor(workspace);

    const start = await server.inject({
      method: "POST",
      url: "/api/v1/scan-runs",
      payload: { dryRun: true, company: "Umbrella Mobile" }
    });
    const finished = await pollUntilDone(server, ScanRunDtoSchema.parse(start.json()).id);

    expect(finished.summary).toMatchObject({ offersFound: 4, offersProjected: 0 });
  });

  it("rejects a second scan while one is active", async () => {
    const workspace = await fixtureWorkspace();
    await writeFile(path.join(workspace, "scan.mjs"), "setTimeout(() => {}, 400);");
    const server = await serverFor(workspace);

    const [first, second] = await Promise.all([
      server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} }),
      server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} })
    ]);
    const statuses = [first.statusCode, second.statusCode].sort();

    expect(statuses).toEqual([202, 409]);
    const accepted = [first, second].find((response) => response.statusCode === 202);
    const rejected = [first, second].find((response) => response.statusCode === 409);
    expect(ErrorResponseDtoSchema.parse(rejected?.json())).toEqual({
      error: {
        code: "SCAN_ALREADY_RUNNING",
        message: "A scan is already running.",
        details: { activeScanRunId: accepted?.json().id }
      }
    });

    await pollUntilDone(server, accepted?.json().id);
    const third = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });
    expect(third.statusCode).toBe(202);
    await pollUntilDone(server, third.json().id);
  });

  it("marks a failing scan as failed with fixed sentences only", async () => {
    const workspace = await fixtureWorkspace();
    const workspaceRealPath = await realpath(workspace);
    await writeFile(
      path.join(workspace, "scan.mjs"),
      [
        "console.log('Errors (1):');",
        `console.log('  ✗ Acme Robotics: cannot read ${workspaceRealPath}/portals.yml');`,
        `console.error('Fatal: CAREER_OPS_PAIRING_TOKEN=pairing-secret at ${homedir()}/x and pairing-secret');`,
        "process.exit(3);"
      ].join("\n")
    );
    const server = await serverFor(workspace, { pairingToken: "pairing-secret" });

    const start = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });
    const finished = await pollUntilDone(server, start.json().id);

    expect(finished).toMatchObject({
      status: "failed",
      stage: "failed",
      exitCode: 3,
      failure: { code: "COMMAND_FAILED", message: "Career Ops scan exited with code 3." },
      summary: { warnings: ["Acme Robotics: the scan failed for this company."] }
    });
    const serialized = JSON.stringify(finished);
    expect(serialized).not.toContain("pairing-secret");
    expect(serialized).not.toContain(workspaceRealPath);
    expect(serialized).not.toContain(homedir());
  });

  it("fails a scan that exceeds the timeout", async () => {
    const workspace = await fixtureWorkspace();
    await writeFile(path.join(workspace, "scan.mjs"), "setInterval(() => {}, 1000);");
    const server = await serverFor(workspace, { scanTimeoutMs: 300 });

    const start = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });
    const finished = await pollUntilDone(server, start.json().id);

    expect(finished).toMatchObject({ status: "failed", failure: { code: "COMMAND_TIMEOUT" }, exitCode: null });
  });

  it("rejects a scan when readiness is not ready", async () => {
    const workspace = await fixtureWorkspace();
    await rm(path.join(workspace, "portals.yml"));
    const server = await serverFor(workspace);

    const response = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });

    expect(response.statusCode).toBe(503);
    const body = ErrorResponseDtoSchema.parse(response.json());
    expect(body.error.code).toBe("WORKSPACE_UNHEALTHY");
    expect(body.error.details).toMatchObject({ reason: "scan-not-ready" });
    expect((body.error.details?.missingRequirements as string[]).length).toBeGreaterThan(0);

    const latest = await server.inject({ method: "GET", url: "/api/v1/scan-runs/latest" });
    expect(latest.statusCode).toBe(404);
  });

  it.each([
    [{ company: "--verify" }],
    [{ company: "" }],
    [{ company: "Acme\nRobotics" }],
    [{ company: "x".repeat(101) }],
    [{ verify: true }],
    [{ dryRun: "yes" }],
    [[]]
  ])("rejects invalid scan request %j", async (payload) => {
    const workspace = await fixtureWorkspace();
    const server = await serverFor(workspace);

    const response = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns NOT_FOUND for unknown or malformed run ids and before any run", async () => {
    const workspace = await fixtureWorkspace();
    const server = await serverFor(workspace);

    for (const url of [
      "/api/v1/scan-runs/latest",
      "/api/v1/scan-runs/scan_20260101000000_abcdef",
      "/api/v1/scan-runs/..%2F..%2Fetc%2Fpasswd"
    ]) {
      const response = await server.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(404);
      expect(response.json().error.code).toBe("NOT_FOUND");
      expect(response.body).not.toContain("etc");
    }
  });
});

describe("scan run output that trips the text contract", () => {
  it("keeps status readable when warnings and stderr look path-like", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(
      path.join(workspace, "scan.mjs"),
      [
        "console.log('Errors (3):');",
        "console.log('  ✗ Acme Robotics: retrying....');",
        "console.log('  ✗ //cdn.example.com/x.js');",
        "console.log('  ✗ ..');",
        "console.error('..');",
        "process.exit(2);"
      ].join("\n")
    );
    const server = await serverFor(workspace);

    const start = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });
    const finished = await pollUntilDone(server, start.json().id);
    const latest = await server.inject({ method: "GET", url: "/api/v1/scan-runs/latest" });

    expect(latest.statusCode).toBe(200);
    expect(finished.summary.warnings).toEqual([
      "Acme Robotics: the scan failed for this company.",
      "2 scan errors could not be matched to a company in portals.yml."
    ]);
    expect(finished.failure?.message).toBe("Career Ops scan exited with code 2.");
  });
});

describe("scan run output never leaves the wrapper", () => {
  // The round-3 findings from PR #8 and earlier regex-redaction leaks.
  const leaks = (workspace: string) => [
    "fetch x-https://jane:hunter2@jobs.example.com/a failed",
    "fetch 1https://jane:hunter2@jobs.example.com/a failed",
    "fetch https://jane:hunter2?x@jobs.example.com/a failed",
    "fetch https://jane:hunter2#x@jobs.example.com/a failed",
    `cannot read ${workspace}-old/cv.pdf`,
    `cannot read ${workspace} ../../etc/passwd`,
    `cannot read ${workspace},../../etc/passwd`,
    `cannot read ${workspace}/%2e%2e/%2e%2e/etc/passwd`,
    `cannot read ${homedir()}/secret.txt`,
    "CAREER_OPS_PAIRING_TOKEN=pairing-secret and pairing-secret"
  ];

  it("returns no path, credential, traversal, or token from stdout or stderr", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    const workspaceRealPath = await realpath(workspace);
    const lines = leaks(workspaceRealPath);
    await writeFile(
      path.join(workspace, "scan.mjs"),
      [
        `console.log(${JSON.stringify("Errors (" + lines.length * 2 + "):")});`,
        ...lines.map((line) => `console.log(${JSON.stringify(`  ✗ Acme Robotics: ${line}`)});`),
        ...lines.map((line) => `console.log(${JSON.stringify(`  ✗ ${line}: HTTP 503`)});`),
        ...lines.map((line) => `console.error(${JSON.stringify(`Fatal: ${line}`)});`),
        "process.exit(1);"
      ].join("\n")
    );
    const server = await serverFor(workspace, { pairingToken: "pairing-secret" });

    const start = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });
    const finished = await pollUntilDone(server, start.json().id);
    const latest = await server.inject({ method: "GET", url: "/api/v1/scan-runs/latest" });

    expect(finished).toMatchObject({
      status: "failed",
      failure: { code: "COMMAND_FAILED", message: "Career Ops scan exited with code 1." },
      summary: {
        warnings: [
          "Acme Robotics: the scan failed for this company.",
          "10 scan errors could not be matched to a company in portals.yml."
        ]
      }
    });
    for (const body of [JSON.stringify(finished), latest.body]) {
      for (const marker of ["hunter2", "jane", "@", "-old", "..", "passwd", "%2e", "pairing-secret", homedir(), workspaceRealPath]) {
        expect(body, marker).not.toContain(marker);
      }
    }
  });
});

describe("scan runs on shutdown", () => {
  it("terminates a running scan when the server closes", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(
      path.join(workspace, "scan.mjs"),
      "import { writeFileSync } from 'node:fs'; setTimeout(() => writeFileSync('late.txt', 'x'), 1500);"
    );
    const server = await createServer({ config: { host: "127.0.0.1", port: 3000, workspace } });

    const start = await server.inject({ method: "POST", url: "/api/v1/scan-runs", payload: {} });
    expect(start.statusCode).toBe(202);
    const closedAt = Date.now();
    await server.close();

    expect(Date.now() - closedAt).toBeLessThan(1500);
    await new Promise((resolve) => setTimeout(resolve, 1700));
    await expect(access(path.join(workspace, "late.txt"))).rejects.toThrow();
  });
});
