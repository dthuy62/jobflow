import { connect, type Socket } from "node:net";
import { ErrorResponseDtoSchema } from "@jobflow/contract";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { clientErrorHandler } from "../src/http/error-handler.js";
import { ApiError, parseRequest } from "../src/http/errors.js";
import { createTestServer, type TestServer } from "./support/server.js";

const SECRET_INPUT = "s3cret-input-value";

function registerTestRoutes(scope: FastifyInstance): void {
  scope.get("/test/api-error", async () => {
    throw new ApiError(409, "CONFLICT", "That conflicts.", { fields: ["a"] });
  });
  scope.get("/test/bad-request", async () => parseRequest(z.strictObject({ name: z.string().min(100) }), { name: SECRET_INPUT }));
  scope.get("/test/bad-stored-data", async () => z.strictObject({ internalColumn: z.string() }).parse({}));
  scope.get("/test/vendor-401", async () => {
    throw Object.assign(new Error("Upstream said no"), { statusCode: 401 });
  });
  scope.get("/test/throw-null", async () => {
    throw null;
  });
  scope.get("/test/numeric-code", async () => {
    throw Object.assign(new Error("grpc UNAVAILABLE"), { code: 14 });
  });
  scope.get("/test/odd-message", async () => {
    throw Object.assign(new Error("x"), { message: { reason: "odd" }, stack: 42 });
  });
  scope.get("/test/client-gone", async () => {
    throw Object.assign(new Error("aborted"), { code: "ECONNRESET" });
  });
  scope.get("/test/many-fields", async () => parseRequest(z.array(z.string()), Array.from({ length: 60 }, () => 1)));
  scope.get("/test/long-key", async () => parseRequest(z.record(z.string(), z.string()), { ["k".repeat(300)]: 1 }));
  scope.get("/test/unknown", async () => {
    throw new Error(`Exploded at /srv/app/x.js with ${SECRET_INPUT}`);
  });
  scope.post("/test/echo", async (request) => request.body);
  scope.get<{ Params: { id: string } }>("/test/items/:id", async (request) => ({ id: request.params.id }));
}

describe("the error envelope", () => {
  let test: TestServer;

  beforeEach(async () => {
    test = await createTestServer({ registerTestRoutes });
  });
  afterEach(async () => {
    await test.server.close();
  });

  const expectEnvelope = (body: string, code: string) => {
    expect(ErrorResponseDtoSchema.parse(JSON.parse(body)).error.code).toBe(code);
  };

  it("ApiError maps to its status and envelope", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/api-error" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "CONFLICT", message: "That conflicts.", details: { fields: ["a"] } } });
  });

  it("request parsing that fails maps to 400 VALIDATION_ERROR with field paths, no input values", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/bad-request" });
    expect(response.statusCode).toBe(400);
    expectEnvelope(response.body, "VALIDATION_ERROR");
    expect(response.json().error.details).toEqual({ fields: ["name"] });
    expect(response.body).not.toContain(SECRET_INPUT);
  });

  it("an unknown error maps to 500 UNEXPECTED_ERROR with a fixed message and no stack", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/unknown" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: "UNEXPECTED_ERROR", message: "Something went wrong." } });
  });

  it("stored data that fails a schema is a logged 500, with no field names, not the client's fault", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/bad-stored-data" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: "UNEXPECTED_ERROR", message: "Something went wrong." } });
    expect(test.logLines().some((line) => line.msg === "unexpected error")).toBe(true);
  });

  it("an upstream error with a 4xx statusCode is a logged 500, not the client's fault", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/vendor-401" });
    expect(response.statusCode).toBe(500);
    expectEnvelope(response.body, "UNEXPECTED_ERROR");
    expect(test.logLines().some((line) => line.msg === "unexpected error")).toBe(true);
  });

  it("a thrown null is still the envelope, with no internal text", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/throw-null" });
    expect(response.statusCode).toBe(500);
    expectEnvelope(response.body, "UNEXPECTED_ERROR");
    expect(response.body).not.toContain("destructure");
    expect(test.logLines().some((line) => line.msg === "unexpected error")).toBe(true);
  });

  it.each(["/test/numeric-code", "/test/odd-message"])("%s still gets the envelope and a log line", async (url) => {
    const response = await test.server.inject({ url: `/api/v1${url}` });
    expect(response.statusCode).toBe(500);
    expectEnvelope(response.body, "UNEXPECTED_ERROR");
    expect(test.logLines().some((line) => line.msg === "unexpected error")).toBe(true);
  });

  it("a client that hung up is not logged as a server error", async () => {
    await test.server.inject({ url: "/api/v1/test/client-gone" });
    expect(test.logLines().filter((line) => (line.level as number) >= 50)).toEqual([]);
  });

  it.each(["/test/many-fields", "/test/long-key"])("%s stays within the contract's limits on details", async (url) => {
    const response = await test.server.inject({ url: `/api/v1${url}` });
    expect(response.statusCode).toBe(400);
    expectEnvelope(response.body, "VALIDATION_ERROR");
  });

  it("a malformed HTTP request gets the envelope on the socket", async () => {
    const address = await test.server.listen({ host: "127.0.0.1", port: 0 });
    const { port } = new URL(address);
    const raw = await new Promise<string>((resolve, reject) => {
      const socket = connect(Number(port), "127.0.0.1", () => socket.write("GET / BAD\r\n\r\n"));
      let received = "";
      socket.on("data", (chunk) => {
        received += String(chunk);
      });
      socket.on("end", () => resolve(received));
      socket.on("error", reject);
    });
    expect(raw).toMatch(/^HTTP\/1\.1 400 /);
    expectEnvelope(raw.slice(raw.indexOf("\r\n\r\n") + 4), "VALIDATION_ERROR");
  });

  it("a request refused before routing still leaves a log line, with no path", async () => {
    await test.server.inject({ url: `/api/v1/test/items/${"x".repeat(300)}` });
    await test.server.inject({ url: "/api/v1/test/items/%zz-s3cret" });
    const lines = test.logLines().filter((line) => line.route === "unmatched" && line.status === 400);
    expect(lines).toHaveLength(2);
    expect(test.logs()).not.toContain("s3cret");
    expect(test.logs()).not.toContain("xxxxx");
  });

  it("an oversized body maps to 413 PAYLOAD_TOO_LARGE", async () => {
    const response = await test.server.inject({
      method: "POST",
      url: "/api/v1/test/echo",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ text: "x".repeat(1024 * 1024 + 1) })
    });
    expect(response.statusCode).toBe(413);
    expectEnvelope(response.body, "PAYLOAD_TOO_LARGE");
  });

  it("a malformed JSON body maps to 400 VALIDATION_ERROR without echoing it", async () => {
    const response = await test.server.inject({
      method: "POST",
      url: "/api/v1/test/echo",
      headers: { "content-type": "application/json" },
      payload: `{"a":"${SECRET_INPUT}"`
    });
    expect(response.statusCode).toBe(400);
    expectEnvelope(response.body, "VALIDATION_ERROR");
    expect(response.body).not.toContain(SECRET_INPUT);
  });

  it("an unsupported content type maps to 415 UNSUPPORTED_MEDIA_TYPE", async () => {
    const response = await test.server.inject({
      method: "POST",
      url: "/api/v1/test/echo",
      headers: { "content-type": "text/xml" },
      payload: "<a/>"
    });
    expect(response.statusCode).toBe(415);
    expectEnvelope(response.body, "UNSUPPORTED_MEDIA_TYPE");
  });

  it.each(["/nope", "/api/v1/nope", "/api/v2/health"])("an unknown path %s returns the 404 NOT_FOUND envelope", async (url) => {
    const response = await test.server.inject({ url });
    expect(response.statusCode).toBe(404);
    expectEnvelope(response.body, "NOT_FOUND");
    expect(response.body).not.toContain("nope");
  });

  it("an unsupported method returns the 404 envelope too", async () => {
    const response = await test.server.inject({ method: "DELETE", url: "/api/v1/health" });
    expect(response.statusCode).toBe(404);
    expectEnvelope(response.body, "NOT_FOUND");
  });

  it("an overlong path parameter gets the envelope, not Fastify's own 414 that echoes the path", async () => {
    const id = "x".repeat(300);
    const response = await test.server.inject({ url: `/api/v1/test/items/${id}` });
    expect(response.statusCode).toBe(400);
    expectEnvelope(response.body, "VALIDATION_ERROR");
    expect(response.body).not.toContain(id);
  });

  it("a malformed percent-encoded path gets the envelope, without echoing it", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/items/%zz-s3cret" });
    expect(response.statusCode).toBe(400);
    expectEnvelope(response.body, "VALIDATION_ERROR");
    expect(response.body).not.toContain("s3cret");
  });
});

describe("clientErrorHandler", () => {
  function run(code: string, socketState: Partial<Socket> = {}): string {
    let written = "";
    const socket = {
      destroyed: false,
      end: (text: string) => {
        written = text;
      },
      ...socketState
    } as unknown as Socket;
    clientErrorHandler(Object.assign(new Error(code), { code }), socket);
    return written;
  }

  it("tells a slow client to retry, because its request was not wrong", () => {
    const written = run("ERR_HTTP_REQUEST_TIMEOUT");
    expect(written).toMatch(/^HTTP\/1\.1 503 /);
    expect(ErrorResponseDtoSchema.parse(JSON.parse(written.slice(written.indexOf("\r\n\r\n") + 4))).error.code).toBe("UNAVAILABLE");
  });

  it("calls a malformed request invalid", () => {
    expect(run("HPE_INVALID_METHOD")).toMatch(/^HTTP\/1\.1 400 /);
  });

  it("writes nothing to a socket that is gone", () => {
    expect(run("ECONNRESET")).toBe("");
    expect(run("HPE_INVALID_METHOD", { destroyed: true })).toBe("");
  });
});
