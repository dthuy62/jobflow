import { ErrorResponseDtoSchema } from "@jobflow/contract";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { AuthUnavailableError } from "../src/core/identity.js";
import type { UserId } from "../src/core/identity.js";
import { ApiError } from "../src/http/errors.js";
import { expectCrossUserDenied } from "./support/cross-user.js";
import { asUser, createMemoryUsers, createTestServer } from "./support/server.js";

const registerSecret = (scope: FastifyInstance) => {
  scope.get("/test/secret", async () => ({ secret: "for-signed-in-users" }));
  scope.post("/test/secret", async () => ({ secret: "for-signed-in-users" }));
};

describe("default deny", () => {
  it("the only public route is GET /api/v1/health", async () => {
    const { server, routes } = await createTestServer({ registerTestRoutes: registerSecret });
    const open = routes.filter((route) => route.config?.public === true);
    expect(new Set(open.map((route) => route.url))).toEqual(new Set(["/api/v1/health"]));
    expect(new Set(open.flatMap((route) => route.method))).toEqual(new Set(["GET", "HEAD"]));
    await server.close();
  });

  it("every other route answers 401 without a token", async () => {
    const { server, routes } = await createTestServer({ registerTestRoutes: registerSecret });
    const protectedRoutes = routes.filter((route) => route.config?.public !== true);
    expect(protectedRoutes.length).toBeGreaterThan(2);
    for (const route of protectedRoutes) {
      for (const method of [route.method].flat()) {
        const response = await server.inject({ method: method as "GET", url: route.url.replace(/:\w+/g, "id_01") });
        expect(response.statusCode, `${method} ${route.url}`).toBe(401);
        // A HEAD response has no body to check.
        if (method !== "HEAD") expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("UNAUTHORIZED");
      }
    }
    await server.close();
  });

  it("a route added later with no auth option is protected too", async () => {
    const { server } = await createTestServer({ registerTestRoutes: registerSecret });
    expect((await server.inject({ url: "/api/v1/test/secret" })).statusCode).toBe(401);
    const allowed = await server.inject({ url: "/api/v1/test/secret", headers: asUser() });
    expect(allowed.statusCode).toBe(200);
    await server.close();
  });

  it("a POST with no token and a malformed body answers 401, not a parse error", async () => {
    const { server } = await createTestServer({ registerTestRoutes: registerSecret });
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/test/secret",
      headers: { "content-type": "application/json" },
      payload: "{bad"
    });
    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it.each(["", "Bearer", "Bearer ", "Basic abc", "abc", "Bearer not-a-jwt", "Bearer a b", "bearer", "Bearer\ttest-user-a"])(
    "Authorization %j gets the 401 envelope",
    async (authorization) => {
      const { server } = await createTestServer();
      const response = await server.inject({ url: "/api/v1/me", headers: { authorization } });
      expect(response.statusCode).toBe(401);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("UNAUTHORIZED");
      expect(response.headers["www-authenticate"]).toBe("Bearer");
      await server.close();
    }
  );

  // The stub accepts these tokens, so only the header parser can refuse them.
  it.each(["Basic test-user-a", "Token test-user-a", "Bearer test-user-a extra", "x Bearer test-user-a"])(
    "Authorization %j gets 401 though its token is good",
    async (authorization) => {
      const { server } = await createTestServer();
      expect((await server.inject({ url: "/api/v1/me", headers: { authorization } })).statusCode).toBe(401);
      await server.close();
    }
  );

  it("a route marked public: false is protected", async () => {
    const { server } = await createTestServer({
      registerTestRoutes: (scope) => scope.get("/test/not-public", { config: { public: false } }, async () => ({ ok: true }))
    });
    expect((await server.inject({ url: "/api/v1/test/not-public" })).statusCode).toBe(401);
    await server.close();
  });

  it("a route's own onRequest hook still runs alongside auth", async () => {
    let ran = false;
    const { server } = await createTestServer({
      registerTestRoutes: (scope) =>
        scope.get(
          "/test/own-hook",
          {
            onRequest: async () => {
              ran = true;
            }
          },
          async () => ({ ok: true })
        )
    });
    expect((await server.inject({ url: "/api/v1/test/own-hook" })).statusCode).toBe(401);
    expect((await server.inject({ url: "/api/v1/test/own-hook", headers: asUser() })).statusCode).toBe(200);
    expect(ran).toBe(true);
    await server.close();
  });

  it("accepts the scheme in any case, as HTTP allows", async () => {
    const { server } = await createTestServer();
    const response = await server.inject({ url: "/api/v1/me", headers: { authorization: "bearer test-user-a" } });
    expect(response.statusCode).toBe(200);
    await server.close();
  });

  it("does not log a rejected token", async () => {
    const { server, logs } = await createTestServer();
    await server.inject({ url: "/api/v1/me", headers: { authorization: "Bearer s3cret-rejected-token" } });
    expect(logs()).not.toContain("s3cret");
    await server.close();
  });
});

describe("when a dependency is down", () => {
  it("AuthUnavailableError gets 503 AUTH_UNAVAILABLE, so the app keeps the user signed in", async () => {
    const { server, logLines } = await createTestServer({
      authVerifier: {
        async verify() {
          throw new AuthUnavailableError(new Error("fetch failed"));
        }
      }
    });
    const response = await server.inject({ url: "/api/v1/me", headers: asUser() });
    expect(response.statusCode).toBe(503);
    expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("AUTH_UNAVAILABLE");
    expect(logLines().some((line) => line.level === 50)).toBe(true);
    await server.close();
  });

  it("a verifier bug gets the logged 500, not a sign-out", async () => {
    const { server } = await createTestServer({
      authVerifier: {
        async verify() {
          throw new Error("bug");
        }
      }
    });
    const response = await server.inject({ url: "/api/v1/me", headers: asUser() });
    expect(response.statusCode).toBe(500);
    await server.close();
  });

  it("a user store failure gets 503 UNAVAILABLE, not 401", async () => {
    const { server, logLines, logs } = await createTestServer({
      users: {
        async resolve() {
          throw new Error("connection to postgres://app:s3cret@db/x failed");
        }
      }
    });
    const response = await server.inject({ url: "/api/v1/me", headers: asUser() });
    expect(response.statusCode).toBe(503);
    expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("UNAVAILABLE");
    expect(response.body).not.toContain("s3cret");
    expect(logs()).not.toContain("s3cret");
    expect(logLines().some((line) => line.level === 50)).toBe(true);
    await server.close();
  });
});

describe("a deleted user", () => {
  it("gets 401", async () => {
    const users = createMemoryUsers();
    users.deletedSubjects.add("test-gone");
    const { server } = await createTestServer({ users });
    const response = await server.inject({ url: "/api/v1/me", headers: { authorization: "Bearer test-gone" } });
    expect(response.statusCode).toBe(401);
    await server.close();
  });
});

describe("expectCrossUserDenied", () => {
  const owners = new Map<string, UserId>();

  const resourceRoutes = (checkOwner: boolean) => (scope: FastifyInstance) => {
    scope.post("/test/notes", async (request) => {
      const id = `note_${owners.size + 1}`;
      owners.set(id, request.auth.userId);
      return { id };
    });
    scope.get<{ Params: { id: string } }>("/test/notes/:id", async (request) => {
      const owner = owners.get(request.params.id);
      if (!owner || (checkOwner && owner !== request.auth.userId)) throw new ApiError(404, "NOT_FOUND", "Resource was not found.");
      return { id: request.params.id, text: "private" };
    });
  };

  const crossUserCase = (server: FastifyInstance) => ({
    server,
    seed: async (headers: Record<string, string>) => (await server.inject({ method: "POST", url: "/api/v1/test/notes", headers })).json().id as string,
    request: (id: string, headers: Record<string, string>) => ({ url: `/api/v1/test/notes/${id}`, headers })
  });

  it("passes for a route that checks the owner", async () => {
    const { server } = await createTestServer({ registerTestRoutes: resourceRoutes(true) });
    await expectCrossUserDenied(crossUserCase(server));
    await server.close();
  });

  it("fails for a route that does not", async () => {
    const { server } = await createTestServer({ registerTestRoutes: resourceRoutes(false) });
    await expect(expectCrossUserDenied(crossUserCase(server))).rejects.toThrow(/another user must get 404/);
    await server.close();
  });

  it("fails for a route that refuses everyone, which would prove nothing", async () => {
    const { server } = await createTestServer({
      registerTestRoutes: (scope) => {
        scope.post("/test/notes", async () => ({ id: "note_1" }));
        scope.get("/test/notes/:id", async () => {
          throw new ApiError(404, "NOT_FOUND", "Resource was not found.");
        });
      }
    });
    await expect(expectCrossUserDenied(crossUserCase(server))).rejects.toThrow(/the owner must still reach it/);
    await server.close();
  });
});
