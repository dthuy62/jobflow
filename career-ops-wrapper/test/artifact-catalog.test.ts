import { appendFile, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import {
  artifactIdForFileName,
  listArtifactFiles,
  openArtifactForDownload
} from "../src/outputs/artifact-catalog.js";
import { readRegularFileNoFollow } from "../src/workspace/workspace-reader.js";
import { copyProjectionFixture, projectionFixturePath, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];

afterEach(async () => {
  await removeWorkspaces(workspaces);
});

async function collect(stream: AsyncIterable<unknown>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

const pdfName = "cv-jane-doe-acme-robotics-2026-06-20.pdf";

describe("artifact catalog", () => {
  it("lists only PDFs in output/ with opaque ids", async () => {
    const artifacts = await listArtifactFiles(projectionFixturePath);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ id: artifactIdForFileName(pdfName), fileName: pdfName });
    expect(artifacts[0]?.id).toMatch(/^artifact_[a-f0-9]{16}$/);
  });

  it("opens an artifact by id and streams its bytes", async () => {
    const download = await openArtifactForDownload(projectionFixturePath, artifactIdForFileName(pdfName));
    const chunks: Buffer[] = [];
    for await (const chunk of download.stream) {
      chunks.push(chunk as Buffer);
    }

    const expected = await readFile(path.join(projectionFixturePath, "output", pdfName));
    expect(Buffer.concat(chunks)).toEqual(expected);
    expect(download.sizeBytes).toBe(expected.length);
    expect(download.fileName).toBe(pdfName);
  });

  it("streams exactly the size seen at open even if the file grows", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    const pdfPath = path.join(workspace, "output", pdfName);
    const original = await readFile(pdfPath);

    const download = await openArtifactForDownload(workspace, artifactIdForFileName(pdfName));
    await appendFile(pdfPath, "x".repeat(4096));
    const bytes = await collect(download.stream);

    expect(download.sizeBytes).toBe(original.length);
    expect(bytes).toEqual(original);
  });

  it("streams an empty PDF as zero bytes", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(path.join(workspace, "output/empty.pdf"), "");

    const download = await openArtifactForDownload(workspace, artifactIdForFileName("empty.pdf"));

    expect(download.sizeBytes).toBe(0);
    expect(await collect(download.stream)).toHaveLength(0);
  });

  it("refuses to read through a path whose directory is a symlink", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "reader-swap-"));
    workspaces.push(workspace);
    await mkdir(path.join(workspace, "real"));
    await writeFile(path.join(workspace, "real/file.md"), "content");
    await symlink(path.join(workspace, "real"), path.join(workspace, "swapped"));

    await expect(
      readRegularFileNoFollow(path.join(await realpath(workspace), "swapped/file.md"), 1024)
    ).rejects.toMatchObject({ code: "PATH_OUTSIDE_WORKSPACE" });
    await expect(
      readRegularFileNoFollow(path.join(await realpath(workspace), "real/file.md"), 1024)
    ).resolves.toMatchObject({ content: "content" });
  });

  it("returns NOT_FOUND for unknown ids", async () => {
    const error = await openArtifactForDownload(projectionFixturePath, "artifact_0000000000000000").catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("NOT_FOUND");
  });
});
