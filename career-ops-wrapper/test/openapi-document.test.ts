import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../src/openapi/openapi-document.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const unimplementedEndpointFamilies = [
  "/api/v1/cv",
  "/api/v1/profile",
  "/api/v1/portals",
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
    expect(Object.keys(document.paths)).toEqual(["/api/v1/health"]);
    expect(document.paths["/api/v1/health"].get).toMatchObject({
      operationId: "getHealth",
      tags: ["Health"],
      security: []
    });

    const serialized = JSON.stringify(document);
    for (const endpoint of unimplementedEndpointFamilies) {
      expect(serialized).not.toContain(endpoint);
    }
  });

  it("builds HealthDto and ErrorResponseDto schemas from backend contracts", () => {
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

    expect(document.components.examples.HealthReady.value).toEqual(healthReady);
    expect(document.components.examples.HealthNotReady.value).toEqual(healthNotReady);
    expect(document.components.examples.ValidationError.value).toEqual(validationError);
    expect(document.components.examples.UnauthorizedError.value).toEqual(unauthorizedError);
    expect(document.components.examples.WorkspaceUnhealthyError.value).toEqual(
      workspaceUnhealthyError
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
