import { ErrorResponseDtoSchema } from "@jobflow/contract";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "../src/http/errors.js";
import { createTestServer, type TestServer } from "./support/server.js";

const SECRET_INPUT = "s3cret-input-value";

function registerTestRoutes(scope: FastifyInstance): void {
  scope.get("/test/api-error", async () => {
    throw new ApiError(409, "CONFLICT", "That conflicts.", { fields: ["a"] });
  });
  scope.get("/test/zod", async () => z.strictObject({ name: z.string().min(100) }).parse({ name: SECRET_INPUT }));
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

  it("a Zod error maps to 400 VALIDATION_ERROR with field paths, no input values", async () => {
    const response = await test.server.inject({ url: "/api/v1/test/zod" });
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
