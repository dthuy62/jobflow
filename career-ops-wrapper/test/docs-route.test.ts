import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

const privateConfig = {
  host: "0.0.0.0",
  port: 3000,
  workspace: "/Users/hy/secret-career-ops-workspace",
  pairingToken: "super-secret-local-pairing-token"
};

describe("API docs routes", () => {
  it("serves the OpenAPI document without requiring a token in LAN/private mode", async () => {
    const server = await createServer({ config: privateConfig });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/openapi.json"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toMatchObject({
        openapi: "3.1.0",
        paths: {
          "/api/v1/health": expect.any(Object)
        }
      });
    } finally {
      await server.close();
    }
  });

  it("serves browser-viewable docs that point to the local OpenAPI document", async () => {
    const server = await createServer({ config: privateConfig });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/docs"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("/openapi.json");
      expect(response.body).toContain("Career Ops Wrapper API");
    } finally {
      await server.close();
    }
  });

  it("does not leak workspace paths or token values through docs output", async () => {
    const server = await createServer({ config: privateConfig });

    try {
      const openApiResponse = await server.inject({
        method: "GET",
        url: "/openapi.json"
      });
      const docsResponse = await server.inject({
        method: "GET",
        url: "/docs"
      });

      const combinedOutput = `${openApiResponse.body}\n${docsResponse.body}`;
      expect(combinedOutput).not.toContain(privateConfig.workspace);
      expect(combinedOutput).not.toContain(privateConfig.pairingToken);
      expect(combinedOutput).not.toContain("API_KEY");
      expect(combinedOutput).not.toContain("cv.md");
      expect(combinedOutput).not.toContain("profile.yml");
    } finally {
      await server.close();
    }
  });
});
