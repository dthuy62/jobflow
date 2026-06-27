import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorResponseDtoSchema, ScanReadinessDtoSchema } from "../src/contracts/index.js";
import { createServer } from "../src/server.js";

const tempDirs: string[] = [];

const profileYaml = `target_roles:
  primary: ["Senior Android Engineer"]
  archetypes:
    - level: "Senior"
narrative:
  superpowers: ["Kotlin"]
compensation:
  location_flexibility: "Remote"
location:
  city: "Da Nang"
`;

const portalYaml = `tracked_companies:
  - name: OpenAI
    careers_url: https://openai.com/careers
    enabled: true
search_queries:
  - name: Android
    query: "site:boards.greenhouse.io Android"
    enabled: true
`;

async function createReadyWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-readiness-route-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  await mkdir(path.join(workspace, "config"), { recursive: true });
  await writeFile(path.join(workspace, "cv.md"), "# Route CV");
  await writeFile(path.join(workspace, "config/profile.yml"), profileYaml);
  await writeFile(path.join(workspace, "portals.yml"), portalYaml);
  await writeFile(path.join(workspace, "doctor.mjs"), "");
  await writeFile(path.join(workspace, "scan.mjs"), "");
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("Scan readiness route", () => {
  it("serves scan readiness under /api/v1/scan-readiness", async () => {
    const workspace = await createReadyWorkspace();
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/scan-readiness"
      });

      expect(response.statusCode).toBe(200);
      const body = ScanReadinessDtoSchema.parse(response.json());
      expect(body).toMatchObject({
        status: "ready",
        canStartScan: true
      });
      expect(body.checks.map((check) => check.name)).toEqual([
        "wrapper",
        "workspace",
        "scanner",
        "cv",
        "profile",
        "portal"
      ]);
    } finally {
      await server.close();
    }
  });

  it("returns not-ready readiness as a 200 DTO", async () => {
    const workspace = await createReadyWorkspace();
    await rm(path.join(workspace, "cv.md"));
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/scan-readiness"
      });

      expect(response.statusCode).toBe(200);
      const body = ScanReadinessDtoSchema.parse(response.json());
      expect(body.status).toBe("notReady");
      expect(body.canStartScan).toBe(false);
      expect(body.missingRequirements).toContain("cv");
      expect(JSON.stringify(body)).not.toContain(workspace);
    } finally {
      await server.close();
    }
  });

  it("protects scan readiness with the local pairing token in LAN mode while health stays public", async () => {
    const workspace = await createReadyWorkspace();
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
        url: "/api/v1/scan-readiness"
      });
      const health = await server.inject({ method: "GET", url: "/api/v1/health" });
      const authorized = await server.inject({
        method: "GET",
        url: "/api/v1/scan-readiness",
        headers: { "x-career-ops-token": "local-secret" }
      });

      expect(unauthorized.statusCode).toBe(401);
      expect(ErrorResponseDtoSchema.parse(unauthorized.json()).error.code).toBe("UNAUTHORIZED");
      expect(health.statusCode).toBe(200);
      expect(authorized.statusCode).toBe(200);
    } finally {
      await server.close();
    }
  });

  it.each(["/api/v1/run", "/api/v1/exec", "/api/v1/command"])(
    "does not expose generic command endpoint %s",
    async (url) => {
      const workspace = await createReadyWorkspace();
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
