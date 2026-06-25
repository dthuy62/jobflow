import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorResponseDtoSchema, ProfileDtoSchema } from "../src/contracts/index.js";
import { createServer } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-profile-route-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  await mkdir(path.join(workspace, "config"), { recursive: true });
  return workspace;
}

async function writeProfile(workspace: string, yaml: string): Promise<void> {
  await writeFile(path.join(workspace, "config/profile.yml"), yaml);
}

const profileYaml = `target_roles:
  primary: ["Senior AI Engineer"]
  archetypes:
    - level: "Senior"
narrative:
  headline: "AI builder"
  superpowers: ["ML pipelines"]
compensation:
  location_flexibility: "Remote preferred"
location:
  city: "San Francisco"
  country: "United States"
`;

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("Profile routes", () => {
  it("serves normalized profile config under /api/v1/profile", async () => {
    const workspace = await createTempWorkspace();
    await writeProfile(workspace, profileYaml);
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/profile"
      });

      expect(response.statusCode).toBe(200);
      expect(ProfileDtoSchema.parse(response.json())).toMatchObject({
        targetRoles: ["Senior AI Engineer"],
        seniorityLevel: "Senior",
        remotePreference: "remote"
      });
    } finally {
      await server.close();
    }
  });

  it.each([
    ["missing profile", undefined, 404, "NOT_FOUND"],
    ["malformed profile", "target_roles: [", 400, "VALIDATION_ERROR"]
  ])("maps %s to a typed error", async (_name, yaml, statusCode, code) => {
    const workspace = await createTempWorkspace();
    if (yaml) {
      await writeProfile(workspace, yaml);
    }
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/profile"
      });

      expect(response.statusCode).toBe(statusCode);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe(code);
      expect(JSON.stringify(response.json())).not.toContain(workspace);
    } finally {
      await server.close();
    }
  });

  it("protects profile routes with the local pairing token in LAN mode", async () => {
    const workspace = await createTempWorkspace();
    await writeProfile(workspace, profileYaml);
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
        url: "/api/v1/profile"
      });
      const authorized = await server.inject({
        method: "GET",
        url: "/api/v1/profile",
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
