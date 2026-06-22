import { chmod, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { getScriptReadiness } from "../src/career-ops-engine/script-readiness.js";

const fixturesRoot = fileURLToPath(new URL("../fixtures/workspaces", import.meta.url));
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("Career Ops local script readiness", () => {
  it("reports ready when doctor, scan, and portal config files are readable", async () => {
    const workspace = path.join(fixturesRoot, "valid-career-ops-config-profile");

    const readiness = await getScriptReadiness(workspace);

    expect(readiness).toEqual({
      status: "ready",
      executionMode: "local-script-runner",
      providerApiKeyRequired: false,
      aiCliRequired: false,
      scanner: {
        status: "ready",
        commandType: "local-script",
        missingRequirements: [],
        checks: [
          { name: "doctor-script", status: "ready" },
          { name: "scan-script", status: "ready" },
          { name: "portal-config", status: "ready" }
        ],
        messages: ["Local Career Ops scan script prerequisites are present."]
      }
    });
    expect(JSON.stringify(readiness)).not.toContain(workspace);
  });

  it.each([
    ["missing doctor", "missing-doctor-script", "doctor-script"],
    ["missing scan", "missing-scan-script", "scan-script"],
    ["missing portals", "missing-portals-yml", "portal-config"]
  ])("reports %s without leaking absolute paths", async (_label, fixtureName, requirement) => {
    const workspace = path.join(fixturesRoot, fixtureName);

    const readiness = await getScriptReadiness(workspace);

    expect(readiness.status).toBe("notReady");
    expect(readiness.scanner.status).toBe("notReady");
    expect(readiness.scanner.missingRequirements).toContain(requirement);
    expect(readiness.scanner.checks).toContainEqual({ name: requirement, status: "missing" });
    expect(JSON.stringify(readiness)).not.toContain(workspace);
  });

  it("supports portals.yaml as the portal config variant", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-portals-yaml-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await writeFile(path.join(workspace, "doctor.mjs"), "");
    await writeFile(path.join(workspace, "scan.mjs"), "");
    await writeFile(path.join(workspace, "portals.yaml"), "portals: []");

    const readiness = await getScriptReadiness(workspace);

    expect(readiness.status).toBe("ready");
    expect(readiness.scanner.checks).toContainEqual({
      name: "portal-config",
      status: "ready"
    });
  });

  it("reports directories with required names as invalid instead of ready", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-script-dir-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await mkdir(path.join(workspace, "doctor.mjs"));
    await writeFile(path.join(workspace, "scan.mjs"), "");
    await writeFile(path.join(workspace, "portals.yml"), "portals: []");

    const readiness = await getScriptReadiness(workspace);

    expect(readiness.status).toBe("notReady");
    expect(readiness.scanner.checks).toContainEqual({
      name: "doctor-script",
      status: "invalid"
    });
  });

  it("rejects symlinked script prerequisites that resolve outside the workspace", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-script-symlink-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    const externalScript = path.join(tmpdir(), `external-scan-${Date.now()}.mjs`);
    await writeFile(path.join(workspace, "doctor.mjs"), "");
    await writeFile(externalScript, "");
    await symlink(externalScript, path.join(workspace, "scan.mjs"));
    await writeFile(path.join(workspace, "portals.yml"), "portals: []");

    try {
      const readiness = await getScriptReadiness(workspace);

      expect(readiness.status).toBe("notReady");
      expect(readiness.scanner.checks).toContainEqual({
        name: "scan-script",
        status: "invalid"
      });
    } finally {
      await rm(externalScript, { force: true });
    }
  });

  it("reports unreadable files as invalid when the platform enforces file permissions", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-unreadable-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await writeFile(path.join(workspace, "doctor.mjs"), "");
    await writeFile(path.join(workspace, "scan.mjs"), "");
    const portalsPath = path.join(workspace, "portals.yml");
    await writeFile(portalsPath, "portals: []");
    await chmod(portalsPath, 0o000);

    try {
      const readiness = await getScriptReadiness(workspace);

      if (readiness.status === "ready") {
        return;
      }

      expect(readiness.status).toBe("notReady");
      expect(readiness.scanner.missingRequirements).toContain("portal-config");
      expect(readiness.scanner.checks).toContainEqual({
        name: "portal-config",
        status: "invalid"
      });
      expect(JSON.stringify(readiness)).not.toContain(workspace);
    } finally {
      await chmod(portalsPath, 0o644);
    }
  });
});
