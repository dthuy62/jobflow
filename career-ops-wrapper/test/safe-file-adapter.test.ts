import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import { writeWorkspaceFileSafely } from "../src/workspace/safe-file-adapter.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-safe-file-${randomUUID()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await chmod(dir, 0o755).catch(() => undefined);
      await rm(dir, { recursive: true, force: true });
    })
  );
});

describe("safe workspace file adapter", () => {
  it("writes a workspace file and preserves the previous file as a backup", async () => {
    const workspace = await createTempWorkspace();
    const cvPath = path.join(workspace, "cv.md");
    await writeFile(cvPath, "# Old CV");

    const result = await writeWorkspaceFileSafely({
      workspacePath: workspace,
      relativePath: "cv.md",
      content: "# New CV"
    });

    await expect(readFile(cvPath, "utf8")).resolves.toBe("# New CV");
    await expect(readFile(path.join(workspace, "cv.md.bak"), "utf8")).resolves.toBe("# Old CV");
    expect(result.targetPath).toBe(await realpath(cvPath));
    expect(result.backupPath).toBe(await realpath(path.join(workspace, "cv.md.bak")));
  });

  it("rejects target paths outside the workspace", async () => {
    const workspace = await createTempWorkspace();

    await expect(
      writeWorkspaceFileSafely({
        workspacePath: workspace,
        relativePath: "../cv.md",
        content: "# CV"
      })
    ).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
  });

  it("rejects symlinked target and backup paths", async () => {
    const workspace = await createTempWorkspace();
    const outside = await createTempWorkspace();
    await writeFile(path.join(outside, "external.md"), "# External");
    await symlink(path.join(outside, "external.md"), path.join(workspace, "cv.md"));

    await expect(
      writeWorkspaceFileSafely({
        workspacePath: workspace,
        relativePath: "cv.md",
        content: "# New CV"
      })
    ).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);

    await rm(path.join(workspace, "cv.md"));
    await writeFile(path.join(workspace, "cv.md"), "# Existing CV");
    await symlink(path.join(outside, "external.md"), path.join(workspace, "cv.md.bak"));

    await expect(
      writeWorkspaceFileSafely({
        workspacePath: workspace,
        relativePath: "cv.md",
        content: "# New CV"
      })
    ).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
    await expect(readFile(path.join(outside, "external.md"), "utf8")).resolves.toBe("# External");
  });

  it("keeps the previous file when writing the replacement fails", async () => {
    const workspace = await createTempWorkspace();
    const cvPath = path.join(workspace, "cv.md");
    await writeFile(cvPath, "# Stable CV");
    await chmod(workspace, 0o555);

    try {
      await expect(
        writeWorkspaceFileSafely({
          workspacePath: workspace,
          relativePath: "cv.md",
          content: "# New CV"
        })
      ).rejects.toMatchObject({
        code: "UNEXPECTED_ERROR"
      } satisfies Partial<ApiError>);

      await expect(readFile(cvPath, "utf8")).resolves.toBe("# Stable CV");
    } finally {
      await chmod(workspace, 0o755);
    }
  });
});
