import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

async function createProtectedTestServer(pairingToken?: string): Promise<FastifyInstance> {
  const server = await createServer({
    config: {
      host: "0.0.0.0",
      port: 3000,
      workspace: process.cwd(),
      ...(pairingToken ? { pairingToken } : {})
    },
    registerTestRoutes: async (apiV1) => {
      apiV1.get("/protected-test", async () => ({ ok: true }));
    }
  });

  return server;
}

describe("Local Pairing Token guard", () => {
  it("leaves health reachable without a token in LAN/private mode", async () => {
    const server = await createProtectedTestServer("local-secret");

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    expect(response.statusCode).toBe(200);
    await server.close();
  });

  it("leaves health with query string reachable without a token in LAN/private mode", async () => {
    const server = await createProtectedTestServer("local-secret");

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health?ts=123"
    });

    expect(response.statusCode).toBe(200);
    await server.close();
  });

  it("rejects missing token on protected routes in LAN/private mode", async () => {
    const server = await createProtectedTestServer("local-secret");

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/protected-test"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid local pairing token is required."
      }
    });
    await server.close();
  });

  it("rejects invalid token on protected routes in LAN/private mode", async () => {
    const server = await createProtectedTestServer("local-secret");

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/protected-test",
      headers: {
        "X-Career-Ops-Token": "wrong-secret"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.stringify(response.json())).not.toContain("local-secret");
    await server.close();
  });

  it("rejects ambiguous duplicate token headers on protected routes", async () => {
    const server = await createProtectedTestServer("local-secret");

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/protected-test",
      headers: {
        "X-Career-Ops-Token": "local-secret,wrong-secret"
      }
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it("allows valid token on protected routes in LAN/private mode", async () => {
    const server = await createProtectedTestServer("local-secret");

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/protected-test",
      headers: {
        "X-Career-Ops-Token": "local-secret"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await server.close();
  });

  it("allows protected routes without token in localhost mode", async () => {
    const server = await createServer({
      config: {
        host: "127.0.0.1",
        port: 3000,
        workspace: process.cwd()
      },
      registerTestRoutes: async (apiV1) => {
        apiV1.get("/protected-test", async () => ({ ok: true }));
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/protected-test"
    });

    expect(response.statusCode).toBe(200);
    await server.close();
  });
});
