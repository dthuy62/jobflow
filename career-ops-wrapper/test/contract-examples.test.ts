import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ArtifactDtoSchema,
  CollectionDtoSchema,
  ErrorCodeSchema,
  ErrorResponseDtoSchema,
  HealthDtoSchema,
  OfferDtoSchema,
  PortalDtoSchema,
  ProfileDtoSchema,
  ReportDetailDtoSchema,
  ReportListItemDtoSchema,
  ScanReadinessDtoSchema,
  ScanRunDtoSchema,
  CvDtoSchema
} from "../src/contracts/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonFixture<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolve(packageRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

describe("contract examples", () => {
  it.each([
    ["health.ready.json", HealthDtoSchema],
    ["health.not-ready.json", HealthDtoSchema],
    ["cv.valid.json", CvDtoSchema],
    ["profile.valid.json", ProfileDtoSchema],
    ["portal.valid.json", PortalDtoSchema],
    ["collection.valid.json", CollectionDtoSchema],
    ["offer.valid.json", OfferDtoSchema],
    ["scan-run.running.json", ScanRunDtoSchema],
    ["report.list-item.valid.json", ReportListItemDtoSchema],
    ["report.detail.valid.json", ReportDetailDtoSchema],
    ["artifact.valid.json", ArtifactDtoSchema]
  ])("validates %s", async (fixtureName, schema) => {
    const example = await readJsonFixture<unknown>(`contracts/examples/${fixtureName}`);

    expect(() => schema.parse(example), fixtureName).not.toThrow();
  });

  it.each([
    "contracts/examples/health.ready.json",
    "contracts/examples/health.not-ready.json"
  ])("validates health example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => HealthDtoSchema.parse(example)).not.toThrow();
  });

  it.each([
    "contracts/examples/scan-readiness.ready.json",
    "contracts/examples/scan-readiness.not-ready.json"
  ])("validates scan readiness example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => ScanReadinessDtoSchema.parse(example)).not.toThrow();
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
    "contracts/examples/errors/workspace-unhealthy.json",
    "contracts/examples/errors/path-outside-workspace.json",
    "contracts/examples/errors/scan-already-running.json"
  ])("validates error example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => ErrorResponseDtoSchema.parse(example)).not.toThrow();
  });

  it.each([
    ["offer", OfferDtoSchema, "contracts/examples/offer.valid.json"],
    ["scan run", ScanRunDtoSchema, "contracts/examples/scan-run.running.json"]
  ])("rejects invalid %s contract fields", async (_name, schema, fixturePath) => {
    const example = await readJsonFixture<Record<string, unknown>>(fixturePath);

    expect(() => schema.parse({ ...example, id: undefined })).toThrow(/id/i);
  });

  it("rejects an artifact that exposes a local path", () => {
    expect(() =>
      ArtifactDtoSchema.parse({
        id: "artifact-001",
        filename: "report.md",
        contentType: "text/markdown",
        sizeBytes: 12,
        downloadUrl: "/Users/example/workspace/report.md"
      })
    ).toThrow(/downloadUrl/i);
  });

  it("rejects an offer with an invalid salary range", () => {
    expect(() =>
      OfferDtoSchema.parse({
        id: "offer-001",
        company: "Example Co",
        title: "Android Engineer",
        source: "career-ops",
        status: "tracked",
        salaryMin: 200000,
        salaryMax: 100000,
        salaryCurrency: "USD",
        workMode: "remote",
        artifactIds: [],
        warnings: []
      })
    ).toThrow(/salaryMax/i);
  });

  it("rejects unknown status values and malformed timestamps", async () => {
    const offer = await readJsonFixture<Record<string, unknown>>(
      "contracts/examples/offer.valid.json"
    );
    const scanRun = await readJsonFixture<Record<string, unknown>>(
      "contracts/examples/scan-run.running.json"
    );

    expect(() => OfferDtoSchema.parse({ ...offer, status: "queued" })).toThrow(/status/i);
    expect(() => ScanRunDtoSchema.parse({ ...scanRun, startedAt: "yesterday" })).toThrow(/startedAt/i);
  });

  it("publishes the error codes that clients mirror", async () => {
    const published = await readJsonFixture<string[]>("contracts/error-codes.json");

    expect(published).toEqual([...ErrorCodeSchema.options].sort());
  });
});
