import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../src/openapi/openapi-document.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const unimplementedEndpointFamilies = [
  "/api/v1/scan-runs",
  "/api/v1/offers",
  "/api/v1/reports",
  "/api/v1/artifacts",
  "/api/v1/run",
  "/api/v1/exec",
  "/api/v1/command"
];

async function readJsonFixture<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolve(packageRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

describe("OpenAPI document", () => {
  it("documents the current implemented API surface only", () => {
    const document = buildOpenApiDocument();

    expect(document.openapi).toBe("3.1.0");
    expect(document.info).toMatchObject({
      title: "Career Ops Wrapper API",
      version: "1.0.0"
    });
    expect(Object.keys(document.paths)).toEqual([
      "/api/v1/health",
      "/api/v1/cv",
      "/api/v1/profile",
      "/api/v1/portals",
      "/api/v1/scan-readiness"
    ]);
    expect(document.paths["/api/v1/health"].get).toMatchObject({
      operationId: "getHealth",
      tags: ["Health"],
      security: []
    });
    expect(document.paths["/api/v1/cv"].get).toMatchObject({
      operationId: "getCv",
      tags: ["CV"]
    });
    expect(document.paths["/api/v1/cv"].put).toMatchObject({
      operationId: "saveCv",
      tags: ["CV"]
    });
    expect(document.paths["/api/v1/profile"].get).toMatchObject({
      operationId: "getProfile",
      tags: ["Profile"]
    });
    expect(document.paths["/api/v1/profile"].put).toMatchObject({
      operationId: "saveProfile",
      tags: ["Profile"]
    });
    expect(document.paths["/api/v1/portals"].get).toMatchObject({
      operationId: "getPortals",
      tags: ["Portals"]
    });
    expect(document.paths["/api/v1/portals"].put).toMatchObject({
      operationId: "savePortals",
      tags: ["Portals"]
    });
    expect(document.paths["/api/v1/scan-readiness"].get).toMatchObject({
      operationId: "getScanReadiness",
      tags: ["Scan Readiness"],
      security: [{ LocalPairingToken: [] }]
    });
    expect(document.paths["/api/v1/cv"].get.responses).toHaveProperty("503");
    expect(document.paths["/api/v1/cv"].put.responses).toHaveProperty("503");
    expect(document.paths["/api/v1/profile"].get.responses).toHaveProperty("400");
    expect(document.paths["/api/v1/profile"].get.responses).toHaveProperty("403");
    expect(document.paths["/api/v1/profile"].get.responses).toHaveProperty("404");
    expect(document.paths["/api/v1/profile"].get.responses).toHaveProperty("503");
    expect(document.paths["/api/v1/profile"].put.responses).toHaveProperty("400");
    expect(document.paths["/api/v1/profile"].put.responses).toHaveProperty("401");
    expect(document.paths["/api/v1/profile"].put.responses).toHaveProperty("403");
    expect(document.paths["/api/v1/profile"].put.responses).toHaveProperty("413");
    expect(document.paths["/api/v1/profile"].put.responses).toHaveProperty("503");
    expect(document.paths["/api/v1/portals"].get.responses).toHaveProperty("400");
    expect(document.paths["/api/v1/portals"].get.responses).toHaveProperty("401");
    expect(document.paths["/api/v1/portals"].get.responses).toHaveProperty("403");
    expect(document.paths["/api/v1/portals"].get.responses).toHaveProperty("404");
    expect(document.paths["/api/v1/portals"].get.responses).toHaveProperty("503");
    expect(document.paths["/api/v1/portals"].put.responses).toHaveProperty("400");
    expect(document.paths["/api/v1/portals"].put.responses).toHaveProperty("401");
    expect(document.paths["/api/v1/portals"].put.responses).toHaveProperty("403");
    expect(document.paths["/api/v1/portals"].put.responses).toHaveProperty("413");
    expect(document.paths["/api/v1/portals"].put.responses).toHaveProperty("503");
    expect(document.paths["/api/v1/scan-readiness"].get.responses).toHaveProperty("200");
    expect(document.paths["/api/v1/scan-readiness"].get.responses).toHaveProperty("401");
    expect(document.paths["/api/v1/scan-readiness"].get.responses).toHaveProperty("403");
    expect(document.paths["/api/v1/scan-readiness"].get.responses).toHaveProperty("503");
    expect(document.paths["/api/v1/scan-readiness"].get.responses).toHaveProperty("500");

    const serialized = JSON.stringify(document);
    for (const endpoint of unimplementedEndpointFamilies) {
      expect(serialized).not.toContain(endpoint);
    }
  });

  it("builds HealthDto, CvDto, ProfileDto, PortalDto, ScanReadinessDto, and ErrorResponseDto schemas from backend contracts", () => {
    const document = buildOpenApiDocument();
    const schemas = document.components.schemas;

    expect(Object.keys(schemas.HealthDto.properties ?? {})).toEqual(
      expect.arrayContaining([
        "status",
        "apiVersion",
        "workspace",
        "careerOps",
        "capabilities",
        "serverTime"
      ])
    );
    expect(Object.keys(schemas.CvDto.properties ?? {})).toEqual(
      expect.arrayContaining(["markdown", "sizeBytes", "updatedAt", "sourceRevision"])
    );
    expect(Object.keys(schemas.ProfileDto.properties ?? {})).toEqual(
      expect.arrayContaining([
        "targetRoles",
        "seniorityLevel",
        "preferredLocations",
        "remotePreference",
        "mustHaveSkills",
        "niceToHaveSkills",
        "excludedKeywords",
        "sourceRevision"
      ])
    );
    expect(Object.keys(schemas.PortalDto.properties ?? {})).toEqual(
      expect.arrayContaining([
        "titlePositiveKeywords",
        "titleNegativeKeywords",
        "trackedCompanies",
        "searchQueries",
        "sourceRevision"
      ])
    );
    expect(Object.keys(schemas.SaveCvRequestDto.properties ?? {})).toEqual(["markdown"]);
    expect(Object.keys(schemas.SaveProfileRequestDto.properties ?? {})).toEqual(
      expect.arrayContaining([
        "targetRoles",
        "seniorityLevel",
        "preferredLocations",
        "remotePreference",
        "mustHaveSkills"
      ])
    );
    expect(Object.keys(schemas.SavePortalRequestDto.properties ?? {})).toEqual(
      expect.arrayContaining([
        "titlePositiveKeywords",
        "titleNegativeKeywords",
        "locationAllowList",
        "locationBlockList",
        "trackedCompanies",
        "searchQueries"
      ])
    );
    expect(Object.keys(schemas.ScanReadinessDto.properties ?? {})).toEqual(
      expect.arrayContaining(["status", "canStartScan", "computedAt", "checks", "missingRequirements"])
    );
    expect(schemas.ErrorResponseDto.properties).toHaveProperty("error");
    expect(document.paths["/api/v1/health"].get.responses["200"].content).toMatchObject({
      "application/json": {
        schema: {
          $ref: "#/components/schemas/HealthDto"
        }
      }
    });
  });

  it("uses checked-in contract examples in OpenAPI responses and components", async () => {
    const document = buildOpenApiDocument();
    const healthReady = await readJsonFixture<unknown>("contracts/examples/health.ready.json");
    const healthNotReady = await readJsonFixture<unknown>(
      "contracts/examples/health.not-ready.json"
    );
    const validationError = await readJsonFixture<unknown>(
      "contracts/examples/errors/validation.json"
    );
    const unauthorizedError = await readJsonFixture<unknown>(
      "contracts/examples/errors/unauthorized.json"
    );
    const workspaceUnhealthyError = await readJsonFixture<unknown>(
      "contracts/examples/errors/workspace-unhealthy.json"
    );
    const cvValid = await readJsonFixture<unknown>("contracts/examples/cv.valid.json");
    const profileValid = await readJsonFixture<unknown>("contracts/examples/profile.valid.json");
    const portalValid = await readJsonFixture<unknown>("contracts/examples/portal.valid.json");
    const scanReadinessReady = await readJsonFixture<unknown>(
      "contracts/examples/scan-readiness.ready.json"
    );
    const scanReadinessNotReady = await readJsonFixture<unknown>(
      "contracts/examples/scan-readiness.not-ready.json"
    );
    const cvMissingError = await readJsonFixture<unknown>(
      "contracts/examples/errors/cv-missing.json"
    );
    const profileMissingError = await readJsonFixture<unknown>(
      "contracts/examples/errors/profile-missing.json"
    );
    const portalMissingError = await readJsonFixture<unknown>(
      "contracts/examples/errors/portal-missing.json"
    );
    const payloadTooLargeError = await readJsonFixture<unknown>(
      "contracts/examples/errors/payload-too-large.json"
    );

    expect(document.components.examples.HealthReady.value).toEqual(healthReady);
    expect(document.components.examples.HealthNotReady.value).toEqual(healthNotReady);
    expect(document.components.examples.ValidationError.value).toEqual(validationError);
    expect(document.components.examples.UnauthorizedError.value).toEqual(unauthorizedError);
    expect(document.components.examples.WorkspaceUnhealthyError.value).toEqual(
      workspaceUnhealthyError
    );
    expect(document.components.examples.CvValid.value).toEqual(cvValid);
    expect(document.components.examples.ProfileValid.value).toEqual(profileValid);
    expect(document.components.examples.PortalValid.value).toEqual(portalValid);
    expect(document.components.examples.ScanReadinessReady.value).toEqual(scanReadinessReady);
    expect(document.components.examples.ScanReadinessNotReady.value).toEqual(scanReadinessNotReady);
    expect(document.components.examples.CvMissingError.value).toEqual(cvMissingError);
    expect(document.components.examples.ProfileMissingError.value).toEqual(profileMissingError);
    expect(document.components.examples.PortalMissingError.value).toEqual(portalMissingError);
    expect(document.components.examples.PayloadTooLargeError.value).toEqual(payloadTooLargeError);
    expect(document.components.examples.PayloadTooLargeError.summary).toBe(
      "Request payload is too large"
    );
    expect(
      document.paths["/api/v1/health"].get.responses["200"].content["application/json"].examples
    ).toMatchObject({
      ready: {
        $ref: "#/components/examples/HealthReady"
      },
      notReady: {
        $ref: "#/components/examples/HealthNotReady"
      }
    });
    expect(
      document.paths["/api/v1/profile"].get.responses["200"].content["application/json"].examples
    ).toMatchObject({
      current: {
        $ref: "#/components/examples/ProfileValid"
      }
    });
    expect(
      document.paths["/api/v1/portals"].get.responses["200"].content["application/json"].examples
    ).toMatchObject({
      current: {
        $ref: "#/components/examples/PortalValid"
      }
    });
    expect(
      document.paths["/api/v1/scan-readiness"].get.responses["200"].content["application/json"].examples
    ).toMatchObject({
      ready: {
        $ref: "#/components/examples/ScanReadinessReady"
      },
      notReady: {
        $ref: "#/components/examples/ScanReadinessNotReady"
      }
    });
    expect(
      document.paths["/api/v1/profile"].put.requestBody.content["application/json"].examples
    ).toMatchObject({
      profile: {
        value: expect.objectContaining({
          targetRoles: expect.any(Array),
          remotePreference: expect.any(String)
        })
      }
    });
    expect(
      document.paths["/api/v1/portals"].put.requestBody.content["application/json"].examples
    ).toMatchObject({
      portals: {
        value: expect.objectContaining({
          titlePositiveKeywords: expect.any(Array),
          trackedCompanies: expect.any(Array),
          searchQueries: expect.any(Array)
        })
      }
    });
  });

  it("documents Local Pairing Token without applying it to public health", () => {
    const document = buildOpenApiDocument();

    expect(document.components.securitySchemes.LocalPairingToken).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "X-Career-Ops-Token",
      description: expect.stringContaining("/docs")
    });
    expect(document.info.description).toContain("/openapi.json");
    expect(document.paths["/api/v1/health"].get.security).toEqual([]);
  });
});
