import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime-config.js";
import { createEvaluationReadiness } from "../src/services/evaluation-readiness.js";
import { createHealthService } from "../src/services/health-service.js";
import { createFakeClaude, type FakeClaude } from "./support/fake-claude.js";
import { copyProjectionFixture, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];
const fakes: FakeClaude[] = [];
afterEach(async () => {
  await removeWorkspaces(workspaces);
  await Promise.all(fakes.splice(0).map((created) => created.remove()));
});

async function setup(behaviour: Parameters<typeof createFakeClaude>[0] = { auth: { loggedIn: true } }) {
  const workspace = await copyProjectionFixture();
  workspaces.push(workspace);
  const fake = await createFakeClaude(behaviour);
  fakes.push(fake);
  const config: RuntimeConfig = {
    host: "127.0.0.1",
    port: 3000,
    workspace,
    evaluation: { provider: "claude", timeoutMs: 60_000, cliPath: fake.cliPath }
  };
  return { workspace, fake, config };
}

describe("evaluation readiness", () => {
  it("is disabled without a provider", async () => {
    const { workspace } = await setup();

    expect(await createEvaluationReadiness({ host: "127.0.0.1", port: 3000, workspace }).get()).toEqual({
      status: "disabled",
      provider: null,
      missingRequirements: ["evaluation.provider-not-configured"]
    });
  });

  it("is ready with a logged-in CLI and a complete workspace", async () => {
    const { config } = await setup();

    expect(await createEvaluationReadiness(config).get()).toMatchObject({
      status: "ready",
      provider: "claude",
      missingRequirements: []
    });
  });

  it("reports a missing and a logged-out CLI", async () => {
    const missing = await setup();
    const config = { ...missing.config, evaluation: { provider: "claude" as const, timeoutMs: 60_000, cliPath: "/nonexistent/claude" } };
    expect((await createEvaluationReadiness(config).get()).missingRequirements).toEqual(["evaluation.cli-missing"]);

    const loggedOut = await setup({ auth: { loggedIn: false } });
    expect(await createEvaluationReadiness(loggedOut.config).get()).toMatchObject({
      status: "notReady",
      provider: "claude",
      missingRequirements: ["evaluation.cli-logged-out"]
    });

    const broken = await setup({ auth: { loggedIn: true, raw: "???" } });
    expect((await createEvaluationReadiness(broken.config).get()).missingRequirements).toEqual([
      "evaluation.cli-check-failed"
    ]);
  });

  it("names missing workspace files and scripts", async () => {
    const { workspace, config } = await setup();
    await rm(path.join(workspace, "modes/oferta.md"));
    await rm(path.join(workspace, "reserve-report-num.mjs"));
    await rm(path.join(workspace, "merge-tracker.mjs"));
    await rm(path.join(workspace, "data/applications.md"));
    await writeFile(path.join(workspace, "cv.md"), "x".repeat(256 * 1024 + 1));

    expect((await createEvaluationReadiness(config).get()).missingRequirements).toEqual([
      "cv.too-large",
      "modes.offer-missing",
      "scripts.reserve-report-num-missing",
      "scripts.merge-tracker-missing",
      "tracker.missing"
    ]);
  });

  it("checks auth once for many concurrent health calls, and again when asked for a fresh check", async () => {
    const { fake, config } = await setup({ auth: { loggedIn: true, delayMs: 150 } });
    const readiness = createEvaluationReadiness(config);
    const health = createHealthService(config, readiness);

    const results = await Promise.all(Array.from({ length: 20 }, () => health.getHealth()));

    expect(await fake.authCalls()).toBe(1);
    expect(results[0]?.capabilities.aiEvaluation).toBe(true);
    expect(results[0]?.careerOps).toMatchObject({
      aiCliRequired: true,
      evaluator: { status: "ready", provider: "claude", missingRequirements: [] }
    });

    await readiness.get(true);
    expect(await fake.authCalls()).toBe(2);
  });

  it("does not change overall health status", async () => {
    const { config } = await setup({ auth: { loggedIn: false } });

    const health = await createHealthService(config, createEvaluationReadiness(config)).getHealth();

    expect(health.capabilities.aiEvaluation).toBe(false);
    expect(health.careerOps.evaluator.status).toBe("notReady");
    expect(health.status).toBe("ready");
    expect(JSON.stringify(health)).not.toContain(config.evaluation?.cliPath ?? "unset");
  });
});
