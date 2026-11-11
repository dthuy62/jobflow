import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestServer, testConfig } from "./support/server.js";

const contract: unknown = JSON.parse(readFileSync(new URL("../../contracts/openapi.json", import.meta.url), "utf8"));

describe("API docs", () => {
  it("development serves the contract and its page without a token", async () => {
    const { server } = await createTestServer({ config: { ...testConfig, env: "development" } });
    const spec = await server.inject({ url: "/openapi.json" });
    expect(spec.statusCode).toBe(200);
    expect(spec.json()).toEqual(contract);
    const page = await server.inject({ url: "/docs" });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(page.body).toContain('url: "/openapi.json"');
    await server.close();
  });

  it.each(["test", "production"] as const)("%s serves neither route", async (env) => {
    const { server } = await createTestServer({ config: { ...testConfig, env } });
    for (const url of ["/openapi.json", "/docs"]) {
      expect((await server.inject({ url })).statusCode, url).toBe(404);
    }
    await server.close();
  });
});
