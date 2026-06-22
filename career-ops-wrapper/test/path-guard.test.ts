import { mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import { resolveWorkspaceRelativePath } from "../src/security/path-guard.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-path-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("workspace path guard", () => {
  it("resolves valid relative paths inside the workspace", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# CV");

    await expect(resolveWorkspaceRelativePath(workspace, "cv.md")).resolves.toBe(
      await realpath(path.join(workspace, "cv.md"))
    );
  });

  it.each(["", ".", "../secrets.md", "profile/../../secret.yml"])(
    "rejects unsafe relative path %s",
    async (input) => {
      const workspace = await createTempWorkspace();

      await expect(resolveWorkspaceRelativePath(workspace, input)).rejects.toMatchObject({
        code: "PATH_OUTSIDE_WORKSPACE"
      } satisfies Partial<ApiError>);
    }
  );

  it("rejects absolute API path input", async () => {
    const workspace = await createTempWorkspace();

    await expect(resolveWorkspaceRelativePath(workspace, "/etc/passwd")).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
  });

  it("rejects symlinks that resolve outside the workspace when supported", async () => {
    const workspace = await createTempWorkspace();
    const outside = await mkdir(path.join(tmpdir(), `career-ops-outside-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(outside);
    await writeFile(path.join(outside, "secret.txt"), "secret");

    try {
      await symlink(path.join(outside, "secret.txt"), path.join(workspace, "secret-link.txt"));
    } catch {
      return;
    }

    await expect(resolveWorkspaceRelativePath(workspace, "secret-link.txt")).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
    });
  });

  it("rejects Windows-style absolute API path input on POSIX hosts", async () => {
    const workspace = await createTempWorkspace();

    await expect(resolveWorkspaceRelativePath(workspace, "C:\\Users\\hy\\secret.txt")).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
  });

  it("maps missing target paths to typed boundary errors", async () => {
    const workspace = await createTempWorkspace();

    await expect(resolveWorkspaceRelativePath(workspace, "missing.md")).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
  });
