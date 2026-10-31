import { readFile, symlink, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArtifactCollectionDtoSchema } from "../src/contracts/index.js";
import { artifactIdForFileName } from "../src/outputs/index.js";
import { normalizeOfferUrl, offerIdForUrl } from "../src/parsers/index.js";
import { createServer } from "../src/server.js";
import { copyProjectionFixture, projectionFixturePath, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];
const pdfName = "cv-jane-doe-acme-robotics-2026-06-20.pdf";

afterEach(async () => {
  await removeWorkspaces(workspaces);
});

async function withServer<T>(workspace: string, run: (server: Awaited<ReturnType<typeof createServer>>) => Promise<T>) {
  const server = await createServer({ config: { host: "127.0.0.1", port: 3000, workspace } });
  try {
    return await run(server);
  } finally {
    await server.close();
  }
}

describe("artifact routes", () => {
  it("lists PDFs with report and offer links", async () => {
    await withServer(projectionFixturePath, async (server) => {
      const response = await server.inject({ method: "GET", url: "/api/v1/artifacts" });

      expect(response.statusCode).toBe(200);
      const collection = ArtifactCollectionDtoSchema.parse(response.json());
      const id = artifactIdForFileName(pdfName);
      expect(collection.items).toEqual([
        {
          id,
          offerId: offerIdForUrl(normalizeOfferUrl("https://jobs.example.com/acme-robotics/senior-android") as string),
          reportId: "report_001",
          filename: pdfName,
          contentType: "application/pdf",
          sizeBytes: expect.any(Number),
          downloadUrl: `/api/v1/artifacts/${id}/download`,
          createdAt: expect.any(String)
        }
      ]);
      expect(collection.sourceRevision).toMatch(/^artifacts_sha256_[a-f0-9]{8}$/);
    });
  });

  it("streams a PDF download with safe headers", async () => {
    await withServer(projectionFixturePath, async (server) => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/artifacts/${artifactIdForFileName(pdfName)}/download`
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toBe(
        `attachment; filename="${pdfName}"; filename*=UTF-8''${pdfName}`
      );
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["cache-control"]).toBe("no-store");
      const expected = await readFile(path.join(projectionFixturePath, "output", pdfName));
      expect(response.rawPayload).toEqual(expected);
      expect(Number(response.headers["content-length"])).toBe(expected.length);
    });
  });

  it("never lists or serves a PDF symlinked outside the workspace", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    const outside = await mkdtemp(path.join(tmpdir(), "artifact-outside-"));
    workspaces.push(outside);
    await writeFile(path.join(outside, "secret.pdf"), "%PDF-secret");
    await symlink(path.join(outside, "secret.pdf"), path.join(workspace, "output/secret.pdf"));

    await withServer(workspace, async (server) => {
      const list = await server.inject({ method: "GET", url: "/api/v1/artifacts" });
      expect(list.json().items.map((item: { filename: string }) => item.filename)).toEqual([pdfName]);

      const download = await server.inject({
        method: "GET",
        url: `/api/v1/artifacts/${artifactIdForFileName("secret.pdf")}/download`
      });
      expect(download.statusCode).toBe(404);
      expect(download.body).not.toContain("secret");
    });
  });

  it.each(["artifact_0000000000000000", "artifact-001", pdfName, "..%2F..%2Fetc%2Fpasswd", "%2Fetc%2Fpasswd"])(
    "returns NOT_FOUND for %s",
    async (id) => {
      await withServer(projectionFixturePath, async (server) => {
        const response = await server.inject({ method: "GET", url: `/api/v1/artifacts/${id}/download` });
        expect(response.statusCode).toBe(404);
        expect(response.json().error).toEqual({ code: "NOT_FOUND", message: "Artifact was not found." });
      });
    }
  );
});
