import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorResponseDtoSchema, PortalDtoSchema } from "../src/contracts/index.js";
import { createServer } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-portal-route-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

async function writePortal(workspace: string, yaml: string): Promise<void> {
  await writeFile(path.join(workspace, "portals.yml"), yaml);
}

const portalYaml = `title_filter:
  positive: ["Flutter"]
  negative: ["Intern"]
tracked_companies:
  - name: OpenAI
    careers_url: https://openai.com/careers
    enabled: true
search_queries:
  - name: Greenhouse Flutter
    query: "site:boards.greenhouse.io Flutter"
    enabled: true
`;

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("Portal routes", () => {
  it("serves normalized portal config under /api/v1/portals", async () => {
    const workspace = await createTempWorkspace();
    await writePortal(workspace, portalYaml);
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/portals"
      });

      expect(response.statusCode).toBe(200);
      expect(PortalDtoSchema.parse(response.json())).toMatchObject({
        titlePositiveKeywords: ["Flutter"],
        trackedCompanies: [{ name: "OpenAI" }],
        searchQueries: [{ label: "Greenhouse Flutter" }]
      });
    } finally {
      await server.close();
    }
  });

  it.each([
    ["missing portal", undefined, 404, "NOT_FOUND"],
    ["malformed portal", "title_filter: [", 400, "VALIDATION_ERROR"]
  ])("maps %s to a typed error", async (_name, yaml, statusCode, code) => {
    const workspace = await createTempWorkspace();
    if (yaml) {
      await writePortal(workspace, yaml);
    }
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/portals"
      });

      expect(response.statusCode).toBe(statusCode);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe(code);
      expect(JSON.stringify(response.json())).not.toContain(workspace);
    } finally {
      await server.close();
    }
  });

  it("protects portal routes with the local pairing token in LAN mode", async () => {
    const workspace = await createTempWorkspace();
    await writePortal(workspace, portalYaml);
    const server = await createServer({
      config: {
        host: "0.0.0.0",
        port: 3000,
        workspace,
        pairingToken: "local-secret"
      }
    });

    try {
      const unauthorized = await server.inject({
        method: "GET",
        url: "/api/v1/portals"
      });
      const authorized = await server.inject({
        method: "GET",
        url: "/api/v1/portals",
        headers: { "x-career-ops-token": "local-secret" }
      });

      expect(unauthorized.statusCode).toBe(401);
      expect(ErrorResponseDtoSchema.parse(unauthorized.json()).error.code).toBe("UNAUTHORIZED");
      expect(authorized.statusCode).toBe(200);
    } finally {
      await server.close();
    }
  });

  it.each(["/api/v1/run", "/api/v1/exec", "/api/v1/command"])(
    "does not expose generic command endpoint %s",
    async (url) => {
      const workspace = await createTempWorkspace();
      const server = await createServer({
        config: { host: "127.0.0.1", port: 3000, workspace }
      });

      try {
        const response = await server.inject({ method: "POST", url });

        expect(response.statusCode).toBe(404);
      } finally {
        await server.close();
      }
    }
  );
});
