import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ErrorResponseDtoSchema,
  PORTAL_CONFIG_MAX_BYTES,
  PortalDtoSchema
} from "../src/contracts/index.js";
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

const saveRequest = {
  titlePositiveKeywords: ["Android", "Kotlin"],
  titleNegativeKeywords: ["Intern"],
  locationAllowList: ["Remote"],
  locationBlockList: ["India"],
  salaryMin: 120000,
  salaryMax: 220000,
  salaryCurrency: "USD",
  trackedCompanies: [
    {
      name: "OpenAI",
      careersUrl: "https://openai.com/careers",
      provider: "websearch",
      enabled: true
    }
  ],
  searchQueries: [
    {
      label: "Greenhouse Android",
      query: "site:boards.greenhouse.io Android",
      enabled: true
    }
  ]
};

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

  it("saves portal config under /api/v1/portals", async () => {
    const workspace = await createTempWorkspace();
    await writePortal(workspace, portalYaml);
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/portals",
        payload: saveRequest
      });

      expect(response.statusCode).toBe(200);
      expect(PortalDtoSchema.parse(response.json())).toMatchObject({
        titlePositiveKeywords: ["Android", "Kotlin"],
        trackedCompanies: [{ name: "OpenAI" }],
        searchQueries: [{ label: "Greenhouse Android" }]
      });
    } finally {
      await server.close();
    }
  });

  it("creates portal config when none exists", async () => {
    const workspace = await createTempWorkspace();
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/portals",
        payload: saveRequest
      });

      expect(response.statusCode).toBe(200);
      expect(PortalDtoSchema.parse(response.json()).titlePositiveKeywords).toEqual([
        "Android",
        "Kotlin"
      ]);
    } finally {
      await server.close();
    }
  });

  it.each([
    ["invalid portal request", { ...saveRequest, titlePositiveKeywords: [" "] }, 400, "VALIDATION_ERROR"],
    ["invalid portal URL", {
      ...saveRequest,
      trackedCompanies: [{ ...saveRequest.trackedCompanies[0], careersUrl: "not-a-url" }]
    }, 400, "VALIDATION_ERROR"],
    [
      "oversized portal request",
      { ...saveRequest, titlePositiveKeywords: ["x".repeat(132_000)] },
      413,
      "PAYLOAD_TOO_LARGE"
    ],
    ["malformed existing portal", saveRequest, 400, "VALIDATION_ERROR"]
  ])("maps %s to a typed save response", async (name, payload, statusCode, code) => {
    const workspace = await createTempWorkspace();
    if (name === "malformed existing portal") {
      await writePortal(workspace, "title_filter: [");
    } else {
      await writePortal(workspace, portalYaml);
    }
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/portals",
        payload
      });

      expect(response.statusCode).toBe(statusCode);
      if (code) {
        const error = ErrorResponseDtoSchema.parse(response.json()).error;
        expect(error.code).toBe(code);
        if (name === "invalid portal request") {
          expect(error.details).toMatchObject({
            issues: [expect.objectContaining({ path: "titlePositiveKeywords.0" })]
          });
        }
      }
      expect(JSON.stringify(response.json())).not.toContain(workspace);
    } finally {
      await server.close();
    }
  });

  it("rejects raw portal save bodies over 128 KiB before saving", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    await writePortal(workspace, portalYaml);
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });
    const rawBody = `{\n${" ".repeat(PORTAL_CONFIG_MAX_BYTES)}"titlePositiveKeywords":["Android"],"titleNegativeKeywords":[],"locationAllowList":[],"locationBlockList":[],"trackedCompanies":[],"searchQueries":[]}`;

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/portals",
        headers: { "content-type": "application/json" },
        payload: rawBody
      });

      expect(response.statusCode).toBe(413);
      expect(ErrorResponseDtoSchema.parse(response.json()).error).toMatchObject({
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload is too large."
      });
      await expect(readFile(portalPath, "utf8")).resolves.toBe(portalYaml);
    } finally {
      await server.close();
    }
  });

  it("protects portal save with the local pairing token in LAN mode", async () => {
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
        method: "PUT",
        url: "/api/v1/portals",
        payload: saveRequest
      });
      const authorized = await server.inject({
        method: "PUT",
        url: "/api/v1/portals",
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
