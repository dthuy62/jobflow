import { mkdtemp, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OfferCollectionDtoSchema, OfferDtoSchema } from "../src/contracts/index.js";
import { SCAN_HISTORY_MAX_BYTES } from "../src/workspace/career-ops-data-adapter.js";
import { createServer } from "../src/server.js";
import { copyProjectionFixture, projectionFixturePath, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];

afterEach(async () => {
  await removeWorkspaces(workspaces);
});

describe("offer routes", () => {
  it("serves the offer list and detail", async () => {
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace: projectionFixturePath }
    });

    try {
      const list = await server.inject({ method: "GET", url: "/api/v1/offers" });
      expect(list.statusCode).toBe(200);
      const collection = OfferCollectionDtoSchema.parse(list.json());
      expect(collection.items).toHaveLength(5);

      const firstId = collection.items[0]?.id as string;
      const detail = await server.inject({ method: "GET", url: `/api/v1/offers/${firstId}` });
      expect(detail.statusCode).toBe(200);
      expect(OfferDtoSchema.parse(detail.json()).id).toBe(firstId);

      for (const id of ["offer_0000000000000000", "offer-001", "..%2F..%2Fetc%2Fpasswd"]) {
        const missing = await server.inject({ method: "GET", url: `/api/v1/offers/${id}` });
        expect(missing.statusCode, id).toBe(404);
        expect(missing.json().error).toEqual({ code: "NOT_FOUND", message: "Offer was not found." });
      }
    } finally {
      await server.close();
    }
  });

  // Both statuses are documented in OpenAPI for GET /offers/{id}.
  it.each([
    {
      status: 403,
      code: "PATH_OUTSIDE_WORKSPACE",
      breakSource: async (workspace: string) => {
        const outside = await mkdtemp(path.join(tmpdir(), "career-ops-outside-"));
        workspaces.push(outside);
        await writeFile(path.join(outside, "applications.md"), "# Applications\n");
        await rm(path.join(workspace, "data/applications.md"));
        await symlink(path.join(outside, "applications.md"), path.join(workspace, "data/applications.md"));
      }
    },
    {
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      breakSource: (workspace: string) =>
        truncate(path.join(workspace, "data/scan-history.tsv"), SCAN_HISTORY_MAX_BYTES + 1)
    }
  ])("returns $status $code on the offer detail when a source file is rejected", async ({ status, code, breakSource }) => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    const server = await createServer({ config: { host: "127.0.0.1", port: 3000, workspace } });

    try {
      const offerId = OfferCollectionDtoSchema.parse((await server.inject({ method: "GET", url: "/api/v1/offers" })).json())
        .items[0]?.id as string;
      await breakSource(workspace);

      const response = await server.inject({ method: "GET", url: `/api/v1/offers/${offerId}` });
      expect(response.statusCode).toBe(status);
      expect(response.json().error.code).toBe(code);
    } finally {
      await server.close();
    }
  });
});
