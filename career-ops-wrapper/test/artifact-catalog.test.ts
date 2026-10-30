import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import {
  artifactIdForFileName,
  listArtifactFiles,
  openArtifactForDownload
} from "../src/outputs/artifact-catalog.js";
import { projectionFixturePath } from "./support/fixture-workspace.js";

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

  it("returns NOT_FOUND for unknown ids", async () => {
    const error = await openArtifactForDownload(projectionFixturePath, "artifact_0000000000000000").catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("NOT_FOUND");
  });
});
