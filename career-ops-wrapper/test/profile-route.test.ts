import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ErrorResponseDtoSchema,
  PROFILE_CONFIG_MAX_BYTES,
  ProfileDtoSchema
} from "../src/contracts/index.js";
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

const saveRequest = {
  targetRoles: ["Senior Android Engineer"],
  seniorityLevel: "Senior",
  preferredLocations: ["Remote", "Global"],
  remotePreference: "remote",
  salaryMin: 3000,
  salaryMax: 5000,
  salaryCurrency: "USD",
  workAuthorizationNote: "No sponsorship needed",
  mustHaveSkills: ["Kotlin", "Compose"],
  niceToHaveSkills: [],
  excludedKeywords: [],
  positioningSummary: "Android engineer"
};

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

  it("saves profile config under /api/v1/profile", async () => {
    const workspace = await createTempWorkspace();
    await writeProfile(workspace, profileYaml);
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/profile",
        payload: saveRequest
      });

      expect(response.statusCode).toBe(200);
      expect(ProfileDtoSchema.parse(response.json())).toMatchObject({
        targetRoles: ["Senior Android Engineer"],
        seniorityLevel: "Senior",
        remotePreference: "remote"
      });
    } finally {
      await server.close();
    }
  });

  it("creates profile config when none exists", async () => {
    const workspace = await createTempWorkspace();
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/profile",
        payload: saveRequest
      });

      expect(response.statusCode).toBe(200);
      expect(ProfileDtoSchema.parse(response.json()).targetRoles).toEqual([
        "Senior Android Engineer"
      ]);
    } finally {
      await server.close();
    }
  });

  it.each([
    ["invalid profile request", { ...saveRequest, targetRoles: [] }, 400, "VALIDATION_ERROR"],
    [
      "oversized profile request",
      { ...saveRequest, positioningSummary: "x".repeat(132_000) },
      413,
      "PAYLOAD_TOO_LARGE"
    ],
    ["malformed existing profile", saveRequest, 400, "VALIDATION_ERROR"]
  ])("maps %s to a typed save error", async (name, payload, statusCode, code) => {
    const workspace = await createTempWorkspace();
    if (name === "malformed existing profile") {
      await writeProfile(workspace, "target_roles: [");
    } else {
      await writeProfile(workspace, profileYaml);
    }
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/profile",
        payload
      });

      expect(response.statusCode).toBe(statusCode);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe(code);
      expect(JSON.stringify(response.json())).not.toContain(workspace);
    } finally {
      await server.close();
    }
  });

  it("rejects raw profile save bodies over 128 KiB before saving", async () => {
    const workspace = await createTempWorkspace();
    const profilePath = path.join(workspace, "config/profile.yml");
    await writeProfile(workspace, profileYaml);
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });
    const rawBody = `{\n${" ".repeat(PROFILE_CONFIG_MAX_BYTES)}"targetRoles":["Senior Android Engineer"],"seniorityLevel":"Senior","preferredLocations":["Remote"],"remotePreference":"remote","mustHaveSkills":["Kotlin"]}`;

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/profile",
        headers: { "content-type": "application/json" },
        payload: rawBody
      });

      expect(response.statusCode).toBe(413);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
      await expect(readFile(profilePath, "utf8")).resolves.toBe(profileYaml);
    } finally {
      await server.close();
    }
  });

  it("protects profile save with the local pairing token in LAN mode", async () => {
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
        method: "PUT",
        url: "/api/v1/profile",
        payload: saveRequest
      });
      const authorized = await server.inject({
        method: "PUT",
        url: "/api/v1/profile",
        payload: saveRequest,
        headers: { "x-career-ops-token": "local-secret" }
      });

      expect(unauthorized.statusCode).toBe(401);
      expect(ErrorResponseDtoSchema.parse(unauthorized.json()).error.code).toBe("UNAUTHORIZED");
      expect(authorized.statusCode).toBe(200);
    } finally {
      await server.close();
    }
  });
});
