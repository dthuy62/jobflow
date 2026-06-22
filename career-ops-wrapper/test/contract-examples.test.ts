import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ErrorResponseDtoSchema,
  HealthDtoSchema
} from "../src/contracts/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonFixture<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolve(packageRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

describe("contract examples", () => {
  it.each([
    "contracts/examples/health.ready.json",
    "contracts/examples/health.not-ready.json"
  ])("validates health example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => HealthDtoSchema.parse(example)).not.toThrow();
  });

  it("documents local script readiness without advertising unimplemented APIs", async () => {
    const example = HealthDtoSchema.parse(
      await readJsonFixture<unknown>("contracts/examples/health.ready.json")
    );

    expect(example.apiVersion).toBe("v1");
    expect(example.careerOps.executionMode).toBe("local-script-runner");
    expect(example.careerOps.providerApiKeyRequired).toBe(false);
    expect(example.careerOps.aiCliRequired).toBe(false);
    expect(example.careerOps.scanner.checks.map((check) => check.name)).toEqual([
      "doctor-script",
      "scan-script",
      "portal-config"
    ]);
    expect(example.capabilities).toMatchObject({
      scan: false,
      reports: false,
      artifacts: false,
      cvConversion: false,
      geminiEvaluation: false
    });
  });

  it.each([
    "contracts/examples/errors/validation.json",
    "contracts/examples/errors/unauthorized.json",
    "contracts/examples/errors/workspace-unhealthy.json"
  ])("validates error example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => ErrorResponseDtoSchema.parse(example)).not.toThrow();
  });
});
