import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { HealthDtoSchema } from "../src/contracts/index.js";

describe("health route", () => {
  it("serves versioned health under /api/v1/health", async () => {
    const server = await createServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/health"
      });

      expect(response.statusCode).toBe(200);
      const body = HealthDtoSchema.parse(response.json());
      expect(body.apiVersion).toBe("v1");
      expect(body.careerOps.executionMode).toBe("local-script-runner");
    } finally {
      await server.close();
    }
  });

  it("keeps health public in LAN mode and accepts query strings", async () => {
    const server = await createServer({
      config: {
        host: "0.0.0.0",
        port: 3000,
        workspace: process.cwd(),
        pairingToken: "local-secret"
      }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/health?source=android"
      });

      expect(response.statusCode).toBe(200);
      expect(() => HealthDtoSchema.parse(response.json())).not.toThrow();
    } finally {
      await server.close();
    }
  });

  it.each(["/run", "/exec", "/command", "/api/v1/run", "/api/v1/exec", "/api/v1/command"])(
    "does not register generic command endpoint %s",
    async (url) => {
      const server = await createServer();

      try {
        const response = await server.inject({
          method: "POST",
          url
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await server.close();
      }
    }
  );

  it.each(["/api/v1/run", "/api/v1/exec", "/api/v1/command"])(
    "does not accept a generic command body at %s",
    async (url) => {
      const server = await createServer();

      try {
        const response = await server.inject({
          method: "POST",
          url,
          payload: { command: "node scan.mjs" }
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await server.close();
      }
    }
  );

  it("does not expose an unversioned health endpoint", async () => {
    const server = await createServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });
});
