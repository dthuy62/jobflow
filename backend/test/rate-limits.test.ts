import { ErrorResponseDtoSchema } from "@jobflow/contract";
import { describe, expect, it } from "vitest";
import { IP_LIMIT_PER_MINUTE, USER_LIMIT_PER_MINUTE } from "../src/http/rate-limits.js";
import { asUser, createTestServer, testConfig } from "./support/server.js";

describe("rate limits", () => {
  it("are 300 a minute per IP and 120 a minute per user", () => {
    expect(IP_LIMIT_PER_MINUTE).toBe(300);
    expect(USER_LIMIT_PER_MINUTE).toBe(120);
  });

  it("over the IP limit returns 429 RATE_LIMITED in the envelope, even with no token", async () => {
    const { server } = await createTestServer();
    for (let index = 0; index < IP_LIMIT_PER_MINUTE; index += 1) {
      expect((await server.inject({ url: "/api/v1/me" })).statusCode).toBe(401);
    }
    const response = await server.inject({ url: "/api/v1/me" });
    expect(response.statusCode).toBe(429);
    const { error } = ErrorResponseDtoSchema.parse(response.json());
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.details?.retryAfterSeconds).toBeGreaterThan(0);
    await server.close();
  });

  it("limits the public health route too", async () => {
    const { server } = await createTestServer();
    for (let index = 0; index < IP_LIMIT_PER_MINUTE; index += 1) await server.inject({ url: "/api/v1/health" });
    const response = await server.inject({ url: "/api/v1/health" });
    expect(response.statusCode).toBe(429);
    expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("RATE_LIMITED");
    await server.close();
  });

  it("limits unknown paths too, which would otherwise be free to flood", async () => {
    const { server } = await createTestServer();
    for (let index = 0; index < IP_LIMIT_PER_MINUTE; index += 1) await server.inject({ url: `/nope/${index}` });
    expect((await server.inject({ url: "/nope/again" })).statusCode).toBe(429);
    await server.close();
  });

  it("over the user limit returns 429 for that user, not for another user on the same IP", async () => {
    const { server } = await createTestServer();
    for (let index = 0; index < USER_LIMIT_PER_MINUTE; index += 1) {
      expect((await server.inject({ url: "/api/v1/me", headers: asUser("busy") })).statusCode).toBe(200);
    }
    const limited = await server.inject({ url: "/api/v1/me", headers: asUser("busy") });
    expect(limited.statusCode).toBe(429);
    expect(ErrorResponseDtoSchema.parse(limited.json()).error.code).toBe("RATE_LIMITED");
    expect((await server.inject({ url: "/api/v1/me", headers: asUser("quiet") })).statusCode).toBe(200);
    await server.close();
  });

  it("counts a user across addresses", async () => {
    const { server } = await createTestServer();
    for (let index = 0; index < USER_LIMIT_PER_MINUTE; index += 1) {
      await server.inject({ url: "/api/v1/me", headers: asUser("roaming"), remoteAddress: `10.0.0.${index % 200}` });
    }
    const limited = await server.inject({ url: "/api/v1/me", headers: asUser("roaming"), remoteAddress: "10.0.1.1" });
    expect(limited.statusCode).toBe(429);
    await server.close();
  });

  it("ignores X-Forwarded-For when TRUST_PROXY is 0", async () => {
    const { server } = await createTestServer();
    for (let index = 0; index < IP_LIMIT_PER_MINUTE; index += 1) {
      await server.inject({ url: "/api/v1/health", headers: { "x-forwarded-for": `6.6.6.${index % 250}` } });
    }
    const response = await server.inject({ url: "/api/v1/health", headers: { "x-forwarded-for": "6.6.7.1" } });
    expect(response.statusCode).toBe(429);
    await server.close();
  });

  it("with TRUST_PROXY=1 and X-Forwarded-For '6.6.6.6, 9.9.9.9', the client IP is 9.9.9.9", async () => {
    const { server } = await createTestServer({
      config: { ...testConfig, trustProxyHops: 1 },
      registerTestRoutes: (scope) => scope.get("/test/ip", async (request) => ({ ip: request.ip }))
    });
    const response = await server.inject({ url: "/api/v1/test/ip", headers: { ...asUser(), "x-forwarded-for": "6.6.6.6, 9.9.9.9" } });
    expect(response.json()).toEqual({ ip: "9.9.9.9" });
    await server.close();
  });

  it("with TRUST_PROXY=1, a client cannot dodge the limit by forging the left of the header", async () => {
    const { server } = await createTestServer({ config: { ...testConfig, trustProxyHops: 1 } });
    for (let index = 0; index < IP_LIMIT_PER_MINUTE; index += 1) {
      await server.inject({ url: "/api/v1/health", headers: { "x-forwarded-for": `6.6.6.${index % 250}, 9.9.9.9` } });
    }
    const response = await server.inject({ url: "/api/v1/health", headers: { "x-forwarded-for": "6.6.7.1, 9.9.9.9" } });
    expect(response.statusCode).toBe(429);
    await server.close();
  });
});
