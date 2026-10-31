import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import { listWorkspaceFiles, readOptionalWorkspaceText } from "../src/workspace/workspace-reader.js";

const tempDirs: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function expectApiError(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
}

describe("readOptionalWorkspaceText", () => {
  it("reads a workspace file and returns undefined when it is missing", async () => {
    const workspace = await tempDir("reader-ws-");
    await mkdir(path.join(workspace, "data"));
    await writeFile(path.join(workspace, "data/pipeline.md"), "# Pipeline");

    const result = await readOptionalWorkspaceText(workspace, "data/pipeline.md", 1024);
    expect(result?.content).toBe("# Pipeline");
    expect(result?.mtime).toBeInstanceOf(Date);
    await expect(readOptionalWorkspaceText(workspace, "data/missing.md", 1024)).resolves.toBeUndefined();
  });

  it("rejects files over the size cap", async () => {
    const workspace = await tempDir("reader-ws-");
    await writeFile(path.join(workspace, "big.md"), "x".repeat(2048));

    await expectApiError(readOptionalWorkspaceText(workspace, "big.md", 1024), "PAYLOAD_TOO_LARGE");
  });

  it("rejects a symlink that escapes the workspace", async () => {
    const workspace = await tempDir("reader-ws-");
    const outside = await tempDir("reader-outside-");
    await writeFile(path.join(outside, "secret.md"), "secret");
    await mkdir(path.join(workspace, "data"));
    await symlink(path.join(outside, "secret.md"), path.join(workspace, "data/pipeline.md"));

    await expectApiError(
      readOptionalWorkspaceText(workspace, "data/pipeline.md", 1024),
      "PATH_OUTSIDE_WORKSPACE"
    );
  });

  it("rejects a data directory symlinked outside the workspace", async () => {
    const workspace = await tempDir("reader-ws-");
    const outside = await tempDir("reader-outside-");
    await writeFile(path.join(outside, "pipeline.md"), "secret");
    await symlink(outside, path.join(workspace, "data"));

    await expectApiError(
      readOptionalWorkspaceText(workspace, "data/pipeline.md", 1024),
      "PATH_OUTSIDE_WORKSPACE"
    );
  });

  it("maps a missing workspace to WORKSPACE_UNHEALTHY", async () => {
    await expectApiError(
      readOptionalWorkspaceText(path.join(tmpdir(), "no-such-workspace-xyz"), "a.md", 10),
      "WORKSPACE_UNHEALTHY"
    );
  });
});

describe("listWorkspaceFiles", () => {
  it("lists matching regular files and skips symlinks and directories", async () => {
    const workspace = await tempDir("reader-ws-");
    const outside = await tempDir("reader-outside-");
    await mkdir(path.join(workspace, "output/nested"), { recursive: true });
    await writeFile(path.join(workspace, "output/b.pdf"), "bb");
    await writeFile(path.join(workspace, "output/a.pdf"), "a");
    await writeFile(path.join(workspace, "output/notes.txt"), "n");
    await writeFile(path.join(outside, "leak.pdf"), "secret");
    await symlink(path.join(outside, "leak.pdf"), path.join(workspace, "output/leak.pdf"));
    await symlink(path.join(workspace, "output/a.pdf"), path.join(workspace, "output/alias.pdf"));

    const files = await listWorkspaceFiles(workspace, "output", (name) => name.endsWith(".pdf"));

    expect(files.map((file) => [file.name, file.sizeBytes])).toEqual([
      ["a.pdf", 1],
      ["b.pdf", 2]
    ]);
    expect(files[0]?.mtime).toBeInstanceOf(Date);
  });

  it("returns nothing for a missing directory or one symlinked outside", async () => {
    const workspace = await tempDir("reader-ws-");
    const outside = await tempDir("reader-outside-");
    await writeFile(path.join(outside, "leak.pdf"), "secret");

    await expect(listWorkspaceFiles(workspace, "output", () => true)).resolves.toEqual([]);

    await symlink(outside, path.join(workspace, "output"));
    await expect(listWorkspaceFiles(workspace, "output", () => true)).resolves.toEqual([]);
  });
});
