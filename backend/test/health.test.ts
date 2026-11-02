import { HealthDtoSchema } from "@jobflow/contract";
import { describe, expect, it } from "vitest";
import { createTestServer } from "./support/server.js";

const SECRET_URL = "postgres://app:s3cret@db/x";

describe("GET /api/v1/health", () => {
  it("returns 200 ok when the database answers", async () => {
    const { server } = await createTestServer();
    const response = await server.inject({ url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);
    expect(HealthDtoSchema.parse(response.json())).toEqual({ status: "ok", checks: { database: "ok" } });
    await server.close();
  });

  it("returns 503 degraded when the database fails", async () => {
    const { server } = await createTestServer({ pool: { query: (async () => Promise.reject(new Error("down"))) as never } });
    const response = await server.inject({ url: "/api/v1/health" });
    expect(response.statusCode).toBe(503);
    expect(HealthDtoSchema.parse(response.json())).toEqual({ status: "degraded", checks: { database: "failed" } });
    await server.close();
  });

  it("returns 503 degraded within 2 s when the database hangs", async () => {
    const { server } = await createTestServer({ pool: { query: (() => new Promise(() => undefined)) as never } });
    const started = performance.now();
    const response = await server.inject({ url: "/api/v1/health" });
    expect(response.statusCode).toBe(503);
    expect(performance.now() - started).toBeLessThan(2_000);
    await server.close();
  });

  it("a database error's connection string is in neither the response nor the log", async () => {
    const { server, logs } = await createTestServer({
      pool: { query: (async () => Promise.reject(new Error(`connect failed for ${SECRET_URL}`))) as never }
    });
    const response = await server.inject({ url: "/api/v1/health" });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("s3cret");
    expect(logs()).toContain("connect failed");
    expect(logs()).not.toContain("s3cret");
    await server.close();
  });
});
