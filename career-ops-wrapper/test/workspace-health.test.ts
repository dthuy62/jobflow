import { chmod, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { getWorkspaceHealth } from "../src/workspace/workspace-health.js";

const fixturesRoot = fileURLToPath(new URL("../fixtures/workspaces", import.meta.url));
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("workspace health", () => {
  it("reports ready for a minimal Career Ops-like workspace without exposing absolute paths", async () => {
    const workspace = path.join(fixturesRoot, "valid-career-ops");

    const health = await getWorkspaceHealth(workspace);

    expect(health).toEqual({
      status: "ready",
      detected: true,
      careerOpsVersion: null,
      missingRequirements: [],
      messages: ["Career Ops workspace is ready."]
    });
    expect(JSON.stringify(health)).not.toContain(workspace);
  });

  it("reports ready for the real Career Ops config/profile.yml layout", async () => {
    const workspace = path.join(fixturesRoot, "valid-career-ops-config-profile");

    const health = await getWorkspaceHealth(workspace);

    expect(health.status).toBe("ready");
    expect(health.missingRequirements).toEqual([]);
    expect(JSON.stringify(health)).not.toContain(workspace);
  });

  it("reports missing workspace safely", async () => {
    const workspace = path.join(fixturesRoot, "does-not-exist");

    const health = await getWorkspaceHealth(workspace);

    expect(health.status).toBe("missing");
    expect(health.detected).toBe(false);
    expect(health.missingRequirements).toContain("workspace");
    expect(health.messages).toContain("Career Ops workspace is missing.");
    expect(JSON.stringify(health)).not.toContain(workspace);
  });

  it("reports invalid structure without leaking the local path", async () => {
    const workspace = path.join(fixturesRoot, "invalid-structure");

    const health = await getWorkspaceHealth(workspace);

    expect(health.status).toBe("invalid");
    expect(health.detected).toBe(true);
    expect(health.missingRequirements).toContain("career-ops-structure");
    expect(health.messages).toContain("Career Ops workspace structure is invalid.");
    expect(JSON.stringify(health)).not.toContain(workspace);
  });

  it("does not treat a generic package-only Node project as ready", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `generic-node-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await writeFile(path.join(workspace, "package.json"), "{}");

    const health = await getWorkspaceHealth(workspace);

    expect(health.status).toBe("invalid");
    expect(health.missingRequirements).toContain("career-ops-structure");
  });

  it("reports ready when the portal config uses portals.yaml", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-portals-yaml-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await mkdir(path.join(workspace, "config"));
    await writeFile(path.join(workspace, "cv.md"), "# Test CV");
    await writeFile(path.join(workspace, "config", "profile.yml"), "name: Test User");
    await writeFile(path.join(workspace, "portals.yaml"), "portals: []");

    const health = await getWorkspaceHealth(workspace);

    expect(health.status).toBe("ready");
    expect(health.missingRequirements).toEqual([]);
  });

  it("does not treat directories named like required source files as ready", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-source-dir-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await mkdir(path.join(workspace, "config"), { recursive: true });
    await mkdir(path.join(workspace, "cv.md"));
    await writeFile(path.join(workspace, "config", "profile.yml"), "name: Test User");
    await writeFile(path.join(workspace, "portals.yml"), "portals: []");

    const health = await getWorkspaceHealth(workspace);

    expect(health.status).toBe("invalid");
    expect(health.missingRequirements).toContain("career-ops-structure");
  });

  it("does not treat symlinked required files outside the workspace as ready", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-source-symlink-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    const externalCv = path.join(tmpdir(), `external-cv-${Date.now()}.md`);
    await mkdir(path.join(workspace, "config"), { recursive: true });
    await writeFile(externalCv, "# External CV");
    await symlink(externalCv, path.join(workspace, "cv.md"));
    await writeFile(path.join(workspace, "config", "profile.yml"), "name: Test User");
    await writeFile(path.join(workspace, "portals.yml"), "portals: []");

    try {
      const health = await getWorkspaceHealth(workspace);

      expect(health.status).toBe("invalid");
      expect(health.missingRequirements).toContain("career-ops-structure");
    } finally {
      await rm(externalCv, { force: true });
    }
  });

  it("reports write access failure when the platform enforces readonly directories", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-readonly-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await mkdir(path.join(workspace, "outputs"));
    await chmod(workspace, 0o555);

    try {
      const health = await getWorkspaceHealth(workspace);

      if (health.status === "ready") {
        return;
      }

      expect(health.status).toBe("invalid");
      expect(health.missingRequirements).toContain("workspace-writable");
    } finally {
      await chmod(workspace, 0o755);
    }
  });

  it("reports listability failure separately when the platform enforces directory permissions", async () => {
    const workspace = await mkdir(path.join(tmpdir(), `career-ops-unlistable-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(workspace);
    await chmod(workspace, 0o000);

    try {
      const health = await getWorkspaceHealth(workspace);

      if (!health.missingRequirements.includes("workspace-listable")) {
        return;
      }

      expect(health.status).toBe("invalid");
      expect(health.missingRequirements).toContain("workspace-listable");
    } finally {
      await chmod(workspace, 0o755);
    }
  });

  it("does not leave timestamp probe files behind during concurrent health checks", async () => {
    const workspace = path.join(fixturesRoot, "valid-career-ops");
    const sentinelPath = path.join(workspace, ".career-ops-wrapper-write-123");
    await rm(sentinelPath, { recursive: true, force: true });

    await Promise.all(Array.from({ length: 8 }, () => getWorkspaceHealth(workspace)));

    await expect(mkdir(sentinelPath, {
      recursive: false
    })).resolves.toBeUndefined();
    await rm(sentinelPath, { recursive: true, force: true });
  });
});
