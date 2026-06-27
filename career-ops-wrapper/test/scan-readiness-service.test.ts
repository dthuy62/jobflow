import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime-config.js";
import { createScanReadinessService } from "../src/services/scan-readiness-service.js";

const tempDirs: string[] = [];
const secretCv = "# Secret CV\n\nDo not leak this markdown.";

const profileYaml = `target_roles:
  primary:
    - "Senior Android Engineer"
  archetypes:
    - level: "Senior"
narrative:
  headline: "Mobile Engineer"
  superpowers:
    - "Kotlin"
compensation:
  location_flexibility: "Remote"
location:
  city: "Da Nang"
`;

const portalYaml = `title_filter:
  positive: ["Android"]
tracked_companies:
  - name: OpenAI
    careers_url: https://openai.com/careers
    enabled: true
search_queries:
  - name: Android
    query: "site:boards.greenhouse.io Android"
    enabled: true
`;

async function createReadyWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-readiness-${Date.now()}-${Math.random()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  await mkdir(path.join(workspace, "config"), { recursive: true });
  await writeFile(path.join(workspace, "cv.md"), secretCv);
  await writeFile(path.join(workspace, "config/profile.yml"), profileYaml);
  await writeFile(path.join(workspace, "portals.yml"), portalYaml);
  await writeFile(path.join(workspace, "doctor.mjs"), "");
  await writeFile(path.join(workspace, "scan.mjs"), "");
  return workspace;
}

function configFor(workspace: string): RuntimeConfig {
  return { host: "127.0.0.1", port: 3000, workspace };
}

function serviceFor(workspace: string) {
  return createScanReadinessService(configFor(workspace));
}

function checkStatus(
  checks: Awaited<ReturnType<ReturnType<typeof serviceFor>["getScanReadiness"]>>["checks"],
  name: string
) {
  const check = checks.find((item) => item.name === name);
  expect(check).toBeDefined();
  return check;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("Scan readiness service", () => {
  it("returns ready only when workspace, scanner, CV, profile, and portal are ready", async () => {
    const workspace = await createReadyWorkspace();

    const readiness = await serviceFor(workspace).getScanReadiness();

    expect(readiness.status).toBe("ready");
    expect(readiness.canStartScan).toBe(true);
    expect(readiness.checks.map((check) => [check.name, check.status])).toEqual([
      ["wrapper", "ready"],
      ["workspace", "ready"],
      ["scanner", "ready"],
      ["cv", "ready"],
      ["profile", "ready"],
      ["portal", "ready"]
    ]);
    expect(checkStatus(readiness.checks, "cv")).toMatchObject({
      sourceRevision: expect.stringMatching(/^cv_sha256_[a-f0-9]{8}$/),
      updatedAt: expect.any(String)
    });
    expect(checkStatus(readiness.checks, "profile")).toMatchObject({
      sourceRevision: expect.stringMatching(/^profile_sha256_[a-f0-9]{8}$/)
    });
    expect(checkStatus(readiness.checks, "portal")).toMatchObject({
      sourceRevision: expect.stringMatching(/^portals_sha256_[a-f0-9]{8}$/)
    });
    expect(JSON.stringify(readiness)).not.toContain(workspace);
    expect(JSON.stringify(readiness)).not.toContain(secretCv);
  });

  it.each([
    ["missing CV", async (workspace: string) => rm(path.join(workspace, "cv.md")), "cv", "cv"],
    [
      "blank CV",
      async (workspace: string) => writeFile(path.join(workspace, "cv.md"), "  \n"),
      "cv",
      "cv.validation"
    ],
    [
      "oversized CV",
      async (workspace: string) => writeFile(path.join(workspace, "cv.md"), "a".repeat(512 * 1024 + 1)),
      "cv",
      "cv.payload-too-large"
    ],
    [
      "missing profile",
      async (workspace: string) => rm(path.join(workspace, "config/profile.yml")),
      "profile",
      "profile.missing"
    ],
    [
      "invalid profile YAML",
      async (workspace: string) => writeFile(path.join(workspace, "config/profile.yml"), "target_roles: ["),
      "profile",
      "profile.validation"
    ],
    [
      "invalid profile structure",
      async (workspace: string) => writeFile(path.join(workspace, "config/profile.yml"), "target_roles: bad\n"),
      "profile",
      "profile.validation"
    ],
    [
      "missing portal",
      async (workspace: string) => rm(path.join(workspace, "portals.yml")),
      "portal",
      "portal.missing"
    ],
    [
      "invalid portal YAML",
      async (workspace: string) => writeFile(path.join(workspace, "portals.yml"), "title_filter: ["),
      "portal",
      "portal.validation"
    ],
    [
      "invalid portal structure",
      async (workspace: string) => writeFile(path.join(workspace, "portals.yml"), "tracked_companies:\n  - bad\n"),
      "portal",
      "portal.validation"
    ],
    [
      "missing scanner",
      async (workspace: string) => rm(path.join(workspace, "scan.mjs")),
      "scanner",
      "scanner.scan-script"
    ]
  ])("returns not ready for %s", async (_label, mutate, checkName, requirement) => {
    const workspace = await createReadyWorkspace();
    await mutate(workspace);

    const readiness = await serviceFor(workspace).getScanReadiness();

    expect(readiness.status).toBe("notReady");
    expect(readiness.canStartScan).toBe(false);
    expect(checkStatus(readiness.checks, checkName)).toMatchObject({
      status: "notReady",
      requirement
    });
    expect(readiness.missingRequirements).toContain(requirement);
    expect(JSON.stringify(readiness)).not.toContain(workspace);
    expect(JSON.stringify(readiness)).not.toContain(secretCv);
  });

  it("does not require a workspace write probe when computing readiness", async () => {
    const workspace = await createReadyWorkspace();
    await chmod(workspace, 0o555);

    try {
      const readiness = await serviceFor(workspace).getScanReadiness();

      if (checkStatus(readiness.checks, "workspace")?.status !== "ready") {
        expect(checkStatus(readiness.checks, "workspace")).not.toMatchObject({
          details: { missingRequirements: expect.arrayContaining(["workspace-writable"]) }
        });
      }
    } finally {
      await chmod(workspace, 0o755);
    }
  });

  it("uses distinct failure messages and stable keys for outside-workspace and unreadable inputs", async () => {
    const workspace = await createReadyWorkspace();
    const externalProfile = path.join(tmpdir(), `external-profile-${Date.now()}.yml`);
    await rm(path.join(workspace, "config/profile.yml"));
    await writeFile(externalProfile, profileYaml);
    await symlink(externalProfile, path.join(workspace, "config/profile.yml"));

    try {
      const outside = await serviceFor(workspace).getScanReadiness();
      expect(checkStatus(outside.checks, "profile")).toMatchObject({
        status: "notReady",
        requirement: "profile.outside-workspace",
        message: "Profile config must stay inside the configured Career Ops Workspace."
      });
      expect(JSON.stringify(outside)).not.toContain(externalProfile);
    } finally {
      await rm(externalProfile, { force: true });
    }

    await rm(path.join(workspace, "config/profile.yml"));
    await mkdir(path.join(workspace, "config/profile.yml"));

    const unreadable = await serviceFor(workspace).getScanReadiness();
    expect(checkStatus(unreadable.checks, "profile")).toMatchObject({
      status: "notReady",
      requirement: "profile.unreadable",
      message: "Profile config is not readable."
    });
  });

  it("does not expose scanner filenames in readiness details", async () => {
    const workspace = await createReadyWorkspace();
    await rm(path.join(workspace, "scan.mjs"));

    const readiness = await serviceFor(workspace).getScanReadiness();

    expect(checkStatus(readiness.checks, "scanner")).toMatchObject({
      requirement: "scanner.scan-script",
      details: { missingRequirements: ["scan-script"] }
    });
    expect(JSON.stringify(readiness)).not.toContain("scan.mjs");
  });

  it("keeps invalid profile and portal files unchanged", async () => {
    const workspace = await createReadyWorkspace();
    const profilePath = path.join(workspace, "config/profile.yml");
    const portalPath = path.join(workspace, "portals.yml");
    const badProfile = "target_roles: [";
    const badPortal = "title_filter: [";
    await writeFile(profilePath, badProfile);
    await writeFile(portalPath, badPortal);

    await serviceFor(workspace).getScanReadiness();

    await expect(readFile(profilePath, "utf8")).resolves.toBe(badProfile);
    await expect(readFile(portalPath, "utf8")).resolves.toBe(badPortal);
  });

  it("returns mixed failures in one sanitized DTO", async () => {
    const workspace = await createReadyWorkspace();
    await rm(path.join(workspace, "cv.md"));
    await rm(path.join(workspace, "scan.mjs"));
    await writeFile(path.join(workspace, "portals.yml"), "title_filter: [");

    const readiness = await serviceFor(workspace).getScanReadiness();

    expect(readiness.status).toBe("notReady");
    expect(readiness.missingRequirements).toEqual(
      expect.arrayContaining(["scanner.scan-script", "cv", "portal.validation"])
    );
    expect(readiness.checks.filter((check) => check.status === "notReady").length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(readiness)).not.toContain(workspace);
    expect(JSON.stringify(readiness)).not.toContain("title_filter: [");
  });

  it("reports invalid workspace without leaking the absolute path", async () => {
    const workspace = path.join(tmpdir(), `missing-readiness-workspace-${Date.now()}`);

    const readiness = await serviceFor(workspace).getScanReadiness();

    expect(readiness.status).toBe("notReady");
    expect(checkStatus(readiness.checks, "workspace")).toMatchObject({
      status: "notReady",
      requirement: "workspace"
    });
    expect(JSON.stringify(readiness)).not.toContain(workspace);
  });
});
