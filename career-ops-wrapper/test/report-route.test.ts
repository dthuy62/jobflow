import { realpath, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ReportCollectionDtoSchema, ReportDetailDtoSchema } from "../src/contracts/index.js";
import { normalizeOfferUrl, offerIdForUrl } from "../src/parsers/index.js";
import { createServer } from "../src/server.js";
import { copyProjectionFixture, projectionFixturePath, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];

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

describe("report routes", () => {
  it("lists reports newest first with offer links", async () => {
    await withServer(projectionFixturePath, async (server) => {
      const response = await server.inject({ method: "GET", url: "/api/v1/reports" });

      expect(response.statusCode).toBe(200);
      const collection = ReportCollectionDtoSchema.parse(response.json());
      expect(collection.sourceRevision).toMatch(/^reports_sha256_[a-f0-9]{8}$/);
      expect(collection.items.map((report) => [report.id, report.kind, report.title])).toEqual([
        ["report_003", "unknown", "Interview notes for Umbrella Mobile"],
        ["report_002", "evaluation", "Globex Labs — Mobile Platform Engineer"],
        ["report_001", "evaluation", "Acme Robotics — Senior Android Engineer"]
      ]);
      expect(collection.items[2]).toMatchObject({
        offerId: offerIdForUrl(normalizeOfferUrl("https://jobs.example.com/acme-robotics/senior-android") as string),
        createdAt: "2026-06-20T00:00:00.000Z"
      });
      expect(collection.items[2]?.sourceRevision).toMatch(/^report_sha256_[a-f0-9]{8}$/);
      expect(collection.items[0]?.offerId).toBeNull();
      expect(collection.items[0]).not.toHaveProperty("markdown");
    });
  });

  it("returns report Markdown with relative links intact", async () => {
    await withServer(projectionFixturePath, async (server) => {
      const response = await server.inject({ method: "GET", url: "/api/v1/reports/report_001" });

      expect(response.statusCode).toBe(200);
      const report = ReportDetailDtoSchema.parse(response.json());
      expect(report.markdown).toContain("# Evaluation: Acme Robotics");
      expect(report.markdown).toContain("(../output/cv-jane-doe-acme-robotics-2026-06-20.pdf)");
    });
  });

  it("redacts workspace and home paths inside report Markdown", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    const workspaceRealPath = await realpath(workspace);
    await writeFile(
      path.join(workspace, "reports/004-leaky-2026-07-01.md"),
      `# Evaluation: Leaky — Role\n\nSaved at ${workspaceRealPath}/reports and ${homedir()}/Downloads.\n`
    );

    await withServer(workspace, async (server) => {
      const response = await server.inject({ method: "GET", url: "/api/v1/reports/report_004" });

      expect(response.statusCode).toBe(200);
      expect(response.json().markdown).toContain("Saved at [WORKSPACE]/reports and [HOME]/Downloads.");
      expect(response.body).not.toContain(workspaceRealPath);
      expect(response.body).not.toContain(homedir());
    });
  });

  it("still lists reports when scan history is over its size cap", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(path.join(workspace, "data/scan-history.tsv"), "x".repeat(10 * 1024 * 1024 + 1));

    await withServer(workspace, async (server) => {
      const reports = await server.inject({ method: "GET", url: "/api/v1/reports" });
      const artifacts = await server.inject({ method: "GET", url: "/api/v1/artifacts" });
      const offers = await server.inject({ method: "GET", url: "/api/v1/offers" });

      expect(reports.statusCode).toBe(200);
      expect(reports.json().items).toHaveLength(3);
      expect(artifacts.statusCode).toBe(200);
      expect(offers.statusCode).toBe(413);
    });
  });

  it("returns PAYLOAD_TOO_LARGE for reports over 1 MiB", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    await writeFile(path.join(workspace, "reports/009-huge.md"), "x".repeat(1024 * 1024 + 1));

    await withServer(workspace, async (server) => {
      const response = await server.inject({ method: "GET", url: "/api/v1/reports/report_009" });
      expect(response.statusCode).toBe(413);
    });
  });

  it.each(["report_999", "report-001", "001", "report_001.md", "..%2Freports%2F001-acme-robotics-2026-06-20.md"])(
    "returns NOT_FOUND for %s",
    async (id) => {
      await withServer(projectionFixturePath, async (server) => {
        const response = await server.inject({ method: "GET", url: `/api/v1/reports/${id}` });
        expect(response.statusCode).toBe(404);
        expect(response.json().error).toEqual({ code: "NOT_FOUND", message: "Report was not found." });
      });
    }
  );
});
