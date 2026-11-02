import { describe, expect, it } from "vitest";
import { LOG_TEXT_MAX_CHARS, redactLogText } from "../src/logging.js";
import { createTestServer } from "./support/server.js";

describe("request logs", () => {
  it("a request's Authorization header, query and body are not logged", async () => {
    const { server, logs } = await createTestServer({
      registerTestRoutes: (scope) => scope.post("/test/echo", async () => ({ ok: true }))
    });
    await server.inject({
      method: "POST",
      url: "/api/v1/test/echo?token=s3cret-query",
      headers: { authorization: "Bearer s3cret-token", "content-type": "application/json" },
      payload: JSON.stringify({ cv: "s3cret-cv-text" })
    });
    expect(logs()).not.toContain("s3cret");
    await server.close();
  });

  it("a log line has request id, route, status and duration, and nothing about the caller", async () => {
    const { server, logLines } = await createTestServer();
    await server.inject({ url: "/api/v1/health?x=1" });
    const line = logLines().find((candidate) => candidate.route === "/api/v1/health");
    expect(line).toMatchObject({ method: "GET", status: 200, route: "/api/v1/health" });
    expect(line?.reqId).toEqual(expect.any(String));
    expect(line?.durationMs).toEqual(expect.any(Number));
    expect(line).not.toHaveProperty("url");
    expect(line).not.toHaveProperty("hostname");
    expect(line).not.toHaveProperty("remoteAddress");
    await server.close();
  });

  it("an unmatched path logs no path, which could hold anything", async () => {
    const { server, logs, logLines } = await createTestServer();
    await server.inject({ url: "/s3cret-path" });
    expect(logs()).not.toContain("s3cret");
    expect(logLines().some((line) => line.route === "unmatched" && line.status === 404)).toBe(true);
    await server.close();
  });

  it("an unexpected error is logged with its name and scrubbed message, and client errors are not logged as errors", async () => {
    const { server, logLines } = await createTestServer({
      registerTestRoutes: (scope) => {
        scope.get("/test/boom", async () => {
          const error = new TypeError("failed on postgres://app:s3cret@db/x") as Error & { detail?: string; code?: string };
          error.detail = "s3cret-detail from a driver";
          error.code = "E_TEST";
          throw error;
        });
        scope.post("/test/echo", async (request) => request.body);
      }
    });
    await server.inject({ url: "/api/v1/test/boom" });
    await server.inject({ method: "POST", url: "/api/v1/test/echo", headers: { "content-type": "application/json" }, payload: "{bad" });

    const errors = logLines().filter((line) => typeof line.err === "object");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.err).toMatchObject({ type: "TypeError", code: "E_TEST" });
    expect(JSON.stringify(errors[0])).toContain("failed on postgres://app:[REDACTED]@db/x");
    expect(JSON.stringify(logLines())).not.toContain("s3cret");
    await server.close();
  });
});

describe("redactLogText", () => {
  it.each([
    ["postgres://app:s3cret@db:5432/x failed", "postgres://app:[REDACTED]@db:5432/x failed"],
    ["postgresql://app:p@ss@db/x", "postgresql://app:[REDACTED]@db/x"],
    ["redis://:s3cret@cache:6379/0", "redis://:[REDACTED]@cache:6379/0"],
    ["postgres://app:ab+c/d==@db/x", "postgres://app:[REDACTED]@db/x"],
    ["https://user:s3cret@example.com/a", "https://user:[REDACTED]@example.com/a"],
    ["Authorization: Bearer abc.def.ghi", "Authorization: Bearer [REDACTED]"],
    ["authorization: Basic dXNlcjpwYXNz", "authorization: Basic [REDACTED]"],
    ["Authorization: ApiKey s3cret value", "Authorization: [REDACTED]"],
    ['Authorization: Digest username="u", response="abc"', "Authorization: [REDACTED]"],
    ['{"authorization":"Bearer abc def"}', '{"authorization":"Bearer [REDACTED]"}'],
    ['["authorization","Bearer abc"]', '["authorization","Bearer [REDACTED]"]'],
    ["authorization: [ 'Bearer abc' ]", "authorization: [ 'Bearer [REDACTED]' ]"]
  ])("redacts %s", (input, expected) => {
    expect(redactLogText(input)).toBe(expected);
  });

  it.each(["connect ECONNREFUSED 127.0.0.1:5432", "https://example.com:8443/jobs", "authorization failed", "the bearer of this role"])(
    "leaves %s alone",
    (text) => {
      expect(redactLogText(text)).toBe(text);
    }
  );

  it("does not log part of a secret that crosses the length cap", () => {
    const secret = "postgres://app:s3cretpassword@db/x";
    for (let offset = 0; offset <= secret.length; offset += 1) {
      const output = redactLogText(`${" ".repeat(LOG_TEXT_MAX_CHARS - offset)}${secret} tail`);
      expect(output, `offset ${offset}`).not.toContain("s3cret");
    }
  });

  it("does not throw away a long message with no spaces", () => {
    const output = redactLogText("x".repeat(LOG_TEXT_MAX_CHARS * 5));
    expect(output.length).toBeGreaterThan(LOG_TEXT_MAX_CHARS / 2);
    expect(output.length).toBeLessThanOrEqual(LOG_TEXT_MAX_CHARS + 20);
    expect(output.endsWith("[truncated]")).toBe(true);
  });

  it.each([
    ["repeated URLs", "postgres://a:".repeat(50_000)],
    ["repeated headers", "Authorization: ".repeat(50_000)],
    ["a header and spaces", `authorization:${" ".repeat(16_370)}`],
    ["a quoted header and spaces", `authorization:${" ".repeat(16_369)}"`],
    ["a long token and a space past the cap", `${"a".repeat(16_382)} b${"c".repeat(100)}`],
    ["repeated schemes", "x://a:".repeat(5_000)]
  ])("stays fast on %s", (_name, text) => {
    const started = performance.now();
    redactLogText(text);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
