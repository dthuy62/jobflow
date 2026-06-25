import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import { createProfileFileAdapter } from "../src/workspace/profile-file-adapter.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-profile-adapter-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

async function writeProfile(workspace: string, relativePath: string, yaml: string): Promise<void> {
  const targetPath = path.join(workspace, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, yaml);
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("profile file adapter", () => {
  it("reads config/profile.yml before root profile.yml", async () => {
    const workspace = await createTempWorkspace();
    await writeProfile(workspace, "profile.yml", "target_roles:\n  primary: [Root]\n");
    await writeProfile(workspace, "config/profile.yml", "target_roles:\n  primary: [Config]\n");

    const result = await createProfileFileAdapter(workspace).readProfileConfig();

    expect(result.relativePath).toBe("config/profile.yml");
    expect(result.parsedProfile).toMatchObject({
      target_roles: {
        primary: ["Config"]
      }
    });
    expect(result.sourceRevision).toMatch(/^profile_sha256_[a-f0-9]{8}$/);
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to root profile.yml and keeps unknown YAML untouched", async () => {
    const workspace = await createTempWorkspace();
    const yaml = "target_roles:\n  primary: [Root]\nunknown_top_level: keep-me\n";
    await writeProfile(workspace, "profile.yml", yaml);

    const result = await createProfileFileAdapter(workspace).readProfileConfig();

    expect(result.relativePath).toBe("profile.yml");
    expect(result.parsedProfile).toMatchObject({ unknown_top_level: "keep-me" });
    await expect(readFile(path.join(workspace, "profile.yml"), "utf8")).resolves.toBe(yaml);
  });

  it.each([
    ["missing profile file", async (workspace: string) => workspace, "NOT_FOUND"],
    [
      "malformed YAML",
      async (workspace: string) => writeProfile(workspace, "config/profile.yml", "candidate: ["),
      "VALIDATION_ERROR"
    ],
    [
      "directory profile path",
      async (workspace: string) => mkdir(path.join(workspace, "config/profile.yml"), { recursive: true }),
      "WORKSPACE_UNHEALTHY"
    ]
  ])("maps %s to a typed error", async (_name, setup, code) => {
    const workspace = await createTempWorkspace();
    await setup(workspace);

    await expect(createProfileFileAdapter(workspace).readProfileConfig()).rejects.toMatchObject({
      code
    } satisfies Partial<ApiError>);
  });

  it("does not fall back when the first profile candidate is unreadable", async () => {
    const workspace = await createTempWorkspace();
    await mkdir(path.join(workspace, "config"), { recursive: true });
    await writeProfile(workspace, "profile.yml", "target_roles:\n  primary: [Root]\n");
    await chmod(path.join(workspace, "config"), 0o000);

    try {
      await expect(createProfileFileAdapter(workspace).readProfileConfig()).rejects.toMatchObject({
        code: "WORKSPACE_UNHEALTHY"
      } satisfies Partial<ApiError>);
    } finally {
      await chmod(path.join(workspace, "config"), 0o700);
    }
  });

  it("rejects symlinked profile files", async () => {
    const workspace = await createTempWorkspace();
    const outside = await mkdir(path.join(tmpdir(), `career-ops-profile-outside-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(outside);
    await writeFile(path.join(outside, "profile.yml"), "target_roles:\n  primary: [Outside]\n");
    await mkdir(path.join(workspace, "config"), { recursive: true });
    await symlink(path.join(outside, "profile.yml"), path.join(workspace, "config/profile.yml"));

    await expect(createProfileFileAdapter(workspace).readProfileConfig()).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
  });
});
