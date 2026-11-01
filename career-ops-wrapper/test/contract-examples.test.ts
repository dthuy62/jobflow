import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ArtifactCollectionDtoSchema,
  ArtifactDtoSchema,
  CollectionDtoSchema,
  ErrorCodeSchema,
  ErrorResponseDtoSchema,
  EvaluationDtoSchema,
  EvaluationModelOutputSchema,
  HealthDtoSchema,
  OfferCollectionDtoSchema,
  OfferDtoSchema,
  PortalDtoSchema,
  ProfileDtoSchema,
  ReportCollectionDtoSchema,
  ReportDetailDtoSchema,
  ReportListItemDtoSchema,
  ScanReadinessDtoSchema,
  ScanRunDtoSchema,
  CvDtoSchema
} from "../src/contracts/index.js";

import { createArtifactService } from "../src/services/artifact-service.js";
import { createOfferService } from "../src/services/offer-service.js";
import { createReportService } from "../src/services/report-service.js";
import { projectionFixturePath } from "./support/fixture-workspace.js";

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
    ["artifact.valid.json", ArtifactDtoSchema],
    ["offer.not-evaluated.json", OfferDtoSchema],
    ["offers.collection.json", OfferCollectionDtoSchema],
    ["scan-run.succeeded.json", ScanRunDtoSchema],
    ["scan-run.failed.json", ScanRunDtoSchema],
    ["reports.collection.json", ReportCollectionDtoSchema],
    ["artifacts.collection.json", ArtifactCollectionDtoSchema],
    ["evaluation.running.json", EvaluationDtoSchema],
    ["evaluation.succeeded.json", EvaluationDtoSchema],
    ["evaluation.failed.json", EvaluationDtoSchema]
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

  // health.ready.json keeps scan/reports/artifacts false until Android's
  // HealthDtoTest is updated alongside it; the live service now reports true.
  it("documents local script readiness without requiring AI providers", async () => {
    const example = HealthDtoSchema.parse(
      await readJsonFixture<unknown>("contracts/examples/health.ready.json")
    );

    expect(example.apiVersion).toBe("v1");
    expect(example.careerOps.executionMode).toBe("local-script-runner");
    expect(example.careerOps.providerApiKeyRequired).toBe(false);
    expect(example.careerOps.aiCliRequired).toBe(true);
    expect(example.careerOps.evaluator).toEqual({ status: "ready", provider: "claude", missingRequirements: [] });
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
      geminiEvaluation: false,
      aiEvaluation: true
    });
  });

  it("rejects AI output that is not exactly the evaluation shape", () => {
    const valid = {
      score: 4.2,
      legitimacy: "High Confidence",
      note: "Strong match.",
      reportMarkdown: "## A) Role Summary\n".padEnd(250, "x")
    };

    expect(EvaluationModelOutputSchema.safeParse(valid).success).toBe(true);
    expect(EvaluationModelOutputSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(EvaluationModelOutputSchema.safeParse({ ...valid, score: 7 }).success).toBe(false);
    expect(EvaluationModelOutputSchema.safeParse({ ...valid, reportMarkdown: "short" }).success).toBe(false);
    expect(EvaluationModelOutputSchema.safeParse({ ...valid, legitimacy: "Maybe" }).success).toBe(false);
  });

  it.each([
    "contracts/examples/errors/validation.json",
    "contracts/examples/errors/unauthorized.json",
    "contracts/examples/errors/workspace-unhealthy.json",
    "contracts/examples/errors/path-outside-workspace.json",
    "contracts/examples/errors/scan-already-running.json",
    "contracts/examples/errors/scan-not-ready.json",
    "contracts/examples/errors/evaluation-already-running.json",
    "contracts/examples/errors/evaluation-not-ready.json",
    "contracts/examples/errors/not-found.json"
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

  it("keeps projection examples in sync with the synthetic fixture workspace", async () => {
    const config = { host: "127.0.0.1", port: 3000, workspace: projectionFixturePath };
    const offers = await createOfferService(config).listOffers();
    const reports = await createReportService(config).listReports();
    const artifacts = await createArtifactService(config).listArtifacts();
    const offersExample = OfferCollectionDtoSchema.parse(
      await readJsonFixture<unknown>("contracts/examples/offers.collection.json")
    );
    const reportsExample = ReportCollectionDtoSchema.parse(
      await readJsonFixture<unknown>("contracts/examples/reports.collection.json")
    );
    const artifactsExample = ArtifactCollectionDtoSchema.parse(
      await readJsonFixture<unknown>("contracts/examples/artifacts.collection.json")
    );
    const withoutTimes = <T extends object>(item: T) => {
      const { updatedAt: _updatedAt, createdAt: _createdAt, sizeBytes: _sizeBytes, ...rest } =
        item as T & { updatedAt?: unknown; createdAt?: unknown; sizeBytes?: unknown };
      return rest;
    };

    expect(offersExample.items).toEqual(offers.items);
    expect(reportsExample.items.map(withoutTimes)).toEqual(reports.items.map(withoutTimes));
    expect(artifactsExample.items.map(withoutTimes)).toEqual(artifacts.items.map(withoutTimes));
  });

  it("publishes the error codes that clients mirror", async () => {
    const published = await readJsonFixture<string[]>("contracts/error-codes.json");

    expect(published).toEqual([...ErrorCodeSchema.options].sort());
  });
});
