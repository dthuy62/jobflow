import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ScanReadinessDtoSchema } from "../src/contracts/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonFixture<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolve(packageRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

const readyDto = {
  status: "ready",
  canStartScan: true,
  computedAt: "2026-06-27T10:00:00.000Z",
  checks: [
    { name: "wrapper", status: "ready", message: "Wrapper backend is available." },
    { name: "workspace", status: "ready", message: "Career Ops workspace is ready." },
    { name: "scanner", status: "ready", message: "Local scan prerequisites are ready." },
    {
      name: "cv",
      status: "ready",
      message: "CV Markdown is ready.",
      sourceRevision: "cv_sha256_0123abcd",
      updatedAt: "2026-06-27T09:00:00.000Z"
    },
    {
      name: "profile",
      status: "ready",
      message: "Profile config is ready.",
      sourceRevision: "profile_sha256_0123abcd",
      updatedAt: "2026-06-27T09:01:00.000Z"
    },
    {
      name: "portal",
      status: "ready",
      message: "Portal config is ready.",
      sourceRevision: "portals_sha256_0123abcd",
      updatedAt: "2026-06-27T09:02:00.000Z"
    }
  ],
  missingRequirements: []
};

const notReadyDto = {
  status: "notReady",
  canStartScan: false,
  computedAt: "2026-06-27T10:00:00.000Z",
  checks: [
    { name: "wrapper", status: "ready", message: "Wrapper backend is available." },
    {
      name: "workspace",
      status: "notReady",
      message: "Career Ops workspace is missing required files.",
      requirement: "workspace",
      details: { code: "WORKSPACE_UNHEALTHY", missingRequirements: ["cv"] }
    },
    {
      name: "scanner",
      status: "notReady",
      message: "Local scan prerequisites are missing.",
      requirement: "scanner.scan-script",
      details: { missingRequirements: ["scan.mjs"] }
    },
    {
      name: "cv",
      status: "notReady",
      message: "CV Markdown is missing.",
      requirement: "cv",
      details: { code: "NOT_FOUND" }
    },
    { name: "profile", status: "ready", message: "Profile config is ready." },
    {
      name: "portal",
      status: "notReady",
      message: "Portal config is invalid.",
      requirement: "portal.validation",
      details: { code: "VALIDATION_ERROR" }
    }
  ],
  missingRequirements: ["workspace", "scanner.scan-script", "cv", "portal.validation"]
};

describe("Scan readiness contract", () => {
  it("validates ready and not-ready DTOs", () => {
    expect(ScanReadinessDtoSchema.parse(readyDto)).toMatchObject({
      status: "ready",
      canStartScan: true
    });
    expect(ScanReadinessDtoSchema.parse(notReadyDto)).toMatchObject({
      status: "notReady",
      canStartScan: false
    });
  });

  it("rejects invalid readiness DTOs", () => {
    expect(() => ScanReadinessDtoSchema.parse({ ...readyDto, status: "degraded" })).toThrow();
    expect(() => ScanReadinessDtoSchema.parse({ ...readyDto, computedAt: "today" })).toThrow();
    expect(() =>
      ScanReadinessDtoSchema.parse({ ...readyDto, checks: readyDto.checks.slice(0, 5) })
    ).toThrow();
    expect(() =>
      ScanReadinessDtoSchema.parse({
        ...readyDto,
        checks: [
          ...readyDto.checks.slice(0, 3),
          { ...readyDto.checks[3], sourceRevision: "/tmp/cv.md" },
          ...readyDto.checks.slice(4)
        ]
      })
    ).toThrow();
    expect(() =>
      ScanReadinessDtoSchema.parse({
        ...notReadyDto,
        checks: [
          ...notReadyDto.checks.slice(0, 1),
          {
            ...notReadyDto.checks[1],
            details: { code: "NOPE", missingRequirements: ["workspace"] }
          },
          ...notReadyDto.checks.slice(2)
        ]
      })
    ).toThrow();
    expect(() =>
      ScanReadinessDtoSchema.parse({
        ...readyDto,
        checks: [
          ...readyDto.checks.slice(0, 3),
          { name: "cv", status: "notReady", message: "CV Markdown is missing." },
          ...readyDto.checks.slice(4)
        ],
        missingRequirements: []
      })
    ).toThrow();
  });

  it.each([
    "contracts/examples/scan-readiness.ready.json",
    "contracts/examples/scan-readiness.not-ready.json"
  ])("validates checked-in scan readiness example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => ScanReadinessDtoSchema.parse(example)).not.toThrow();
  });
});
