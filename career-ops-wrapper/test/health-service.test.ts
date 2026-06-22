import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createHealthService } from "../src/services/health-service.js";

const validWorkspace = fileURLToPath(
  new URL("../fixtures/workspaces/valid-career-ops", import.meta.url)
);
const missingScanWorkspace = fileURLToPath(
  new URL("../fixtures/workspaces/missing-scan-script", import.meta.url)
);
const invalidWorkspace = fileURLToPath(
  new URL("../fixtures/workspaces/invalid-structure", import.meta.url)
);

describe("health service capabilities", () => {
  it("reports ready workspace and local script readiness without advertising future APIs", async () => {
    const health = await createHealthService({
      host: "127.0.0.1",
      port: 3000,
      workspace: validWorkspace
    }).getHealth();

    expect(health.status).toBe("ready");
    expect(health.apiVersion).toBe("v1");
    expect(health.workspace).toMatchObject({
      status: "ready",
      messages: ["Career Ops workspace is ready."]
    });
    expect(health.careerOps).toMatchObject({
      status: "ready",
      executionMode: "local-script-runner",
      providerApiKeyRequired: false,
      aiCliRequired: false,
      scanner: {
        status: "ready",
        commandType: "local-script",
        missingRequirements: []
      }
    });
    expect(health.capabilities).toMatchObject({
      cv: true,
      profile: true,
      portals: true,
      scan: false,
      reports: false,
      artifacts: false,
      cvConversion: false,
      geminiEvaluation: false
    });
    expect(JSON.stringify(health)).not.toContain(validWorkspace);
  });

  it("reports not ready when workspace is valid but local scan script is missing", async () => {
    const health = await createHealthService({
      host: "127.0.0.1",
      port: 3000,
      workspace: missingScanWorkspace
    }).getHealth();

    expect(health.status).toBe("notReady");
    expect(health.workspace.status).toBe("ready");
    expect(health.careerOps.status).toBe("notReady");
    expect(health.careerOps.scanner.missingRequirements).toContain("scan-script");
    expect(health.capabilities.scan).toBe(false);
    expect(JSON.stringify(health)).not.toContain(missingScanWorkspace);
  });

  it("reports not ready when workspace is invalid even if script files are not the blocker", async () => {
    const health = await createHealthService({
      host: "127.0.0.1",
      port: 3000,
      workspace: invalidWorkspace
    }).getHealth();

    expect(health.status).toBe("notReady");
    expect(health.workspace.status).toBe("invalid");
    expect(health.workspace.missingRequirements).toContain("career-ops-structure");
    expect(health.careerOps.status).toBe("notReady");
    expect(health.capabilities).toMatchObject({
      cv: false,
      profile: false,
      portals: false,
      scan: false,
      reports: false,
      artifacts: false
    });
  });
});
