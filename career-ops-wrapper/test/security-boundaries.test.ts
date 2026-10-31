import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../src/openapi/openapi-document.js";
import { createServer } from "../src/server.js";
import { copyProjectionFixture, removeWorkspaces } from "./support/fixture-workspace.js";

const token = "lan-pairing-token-7f3a";
const workspaces: string[] = [];
let workspace: string;
let workspaceRealPath: string;
let server: FastifyInstance;

const sampleIds: Record<string, string> = {
  "/api/v1/scan-runs/{id}": "scan_20260101000000_abcdef",
  "/api/v1/offers/{id}": "offer_0000000000000000",
  "/api/v1/reports/{id}": "report_001",
  "/api/v1/artifacts/{id}/download": "artifact_0000000000000000"
};

// Route-specific, so Fastify's default 404 for an unregistered route cannot satisfy the traversal tests.
const notFoundMessages: Record<string, string> = {
  "/api/v1/scan-runs/{id}": "Scan run was not found.",
  "/api/v1/offers/{id}": "Offer was not found.",
  "/api/v1/reports/{id}": "Report was not found.",
  "/api/v1/artifacts/{id}/download": "Artifact was not found."
};

const traversalIds = [
  "..%2F..%2Fetc%2Fpasswd",
  "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "..%5C..%5Cwindows",
  "%2Fetc%2Fpasswd",
  "report_001%2F..%2F..%2Fcv.md",
  "offer_%00",
  "x".repeat(100)
];

const protectedOperations = Object.entries(buildOpenApiDocument().paths).flatMap(([route, pathItem]) =>
  Object.keys(pathItem)
    .filter(() => route !== "/api/v1/health")
    .map((method) => ({ method: method.toUpperCase() as "GET" | "POST", route }))
);

function concreteUrl(route: string, id?: string): string {
  return route.replace("{id}", id ?? sampleIds[route] ?? "unknown");
}

beforeAll(async () => {
  workspace = await copyProjectionFixture();
  workspaces.push(workspace);
  workspaceRealPath = await realpath(workspace);
  server = await createServer({
    config: { host: "0.0.0.0", port: 3000, workspace, pairingToken: token }
  });
});

afterAll(async () => {
  await server.close();
  await removeWorkspaces(workspaces);
});

describe("security boundaries", () => {
  it("covers every new route family in the token suite", () => {
    expect(protectedOperations.map((operation) => operation.route)).toEqual(
      expect.arrayContaining([
        "/api/v1/scan-runs",
        "/api/v1/scan-runs/latest",
        "/api/v1/scan-runs/{id}",
        "/api/v1/offers",
        "/api/v1/offers/{id}",
        "/api/v1/reports",
        "/api/v1/reports/{id}",
        "/api/v1/artifacts",
        "/api/v1/artifacts/{id}/download"
      ])
    );
  });

  it.each(protectedOperations)("requires the pairing token for $method $route", async ({ method, route }) => {
    for (const headers of [{}, { "X-Career-Ops-Token": "wrong-token" }, { "X-Career-Ops-Token": `${token},${token}` }]) {
      const response = await server.inject({
        method,
        url: concreteUrl(route),
        headers,
        ...(method === "POST" ? { payload: { dryRun: true } } : {})
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: { code: "UNAUTHORIZED", message: "A valid local pairing token is required." }
      });
      expect(response.body).not.toContain(token);
    }
  });

  it.each(Object.keys(sampleIds).flatMap((route) => traversalIds.map((id) => ({ route, id }))))(
    "returns NOT_FOUND for traversal id $id on $route",
    async ({ route, id }) => {
      const response = await server.inject({
        method: "GET",
        url: concreteUrl(route, id),
        headers: { "X-Career-Ops-Token": token }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: "NOT_FOUND", message: notFoundMessages[route] } });
      expect(response.body).not.toContain("root:");
      expect(response.body).not.toContain("Jane Doe");
      expect(response.body).not.toContain(workspaceRealPath);
    }
  );

  // Fastify rejects path parameters over 100 characters before routing; the
  // /api/v1 not-found handler still answers with the error envelope.
  it.each(Object.keys(sampleIds))("returns NOT_FOUND without leaking for an overlong id on %s", async (route) => {
    for (const id of ["x".repeat(101), "x".repeat(300), `${sampleIds[route]}${"0".repeat(100)}`]) {
      const response = await server.inject({
        method: "GET",
        url: concreteUrl(route, id),
        headers: { "X-Career-Ops-Token": token }
      });

      expect(response.statusCode, id).toBe(404);
      expect(response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Resource was not found." } });
      expect(response.body).not.toContain(workspaceRealPath);
    }
  });

  it("requires the pairing token before answering an overlong id", async () => {
    const response = await server.inject({ method: "GET", url: concreteUrl("/api/v1/offers/{id}", "x".repeat(300)) });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });

  it("never returns workspace paths, home paths, or the token from read routes", async () => {
    const urls = ["/api/v1/offers", "/api/v1/reports", "/api/v1/artifacts", "/api/v1/reports/report_001", "/api/v1/health"];
    const offers = await server.inject({ method: "GET", url: "/api/v1/offers", headers: { "X-Career-Ops-Token": token } });
    urls.push(...offers.json().items.map((offer: { id: string }) => `/api/v1/offers/${offer.id}`));

    for (const url of urls) {
      const response = await server.inject({ method: "GET", url, headers: { "X-Career-Ops-Token": token } });

      expect(response.statusCode, url).toBe(200);
      for (const secret of [workspace, workspaceRealPath, homedir(), token]) {
        expect(response.body, `${url} leaked ${secret}`).not.toContain(secret);
      }
    }
  });

  it("does not leak paths or the token through the OpenAPI document", async () => {
    const response = await server.inject({ method: "GET", url: "/openapi.json" });

    expect(response.statusCode).toBe(200);
    for (const secret of [workspace, workspaceRealPath, homedir(), token]) {
      expect(response.body).not.toContain(secret);
    }
  });
});
