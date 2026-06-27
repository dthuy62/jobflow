import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ErrorResponseDtoSchema,
  PORTAL_CONFIG_MAX_BYTES,
  PortalDtoSchema,
  SavePortalRequestDtoSchema
} from "../src/contracts/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonFixture<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolve(packageRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

const validPortal = {
  titlePositiveKeywords: ["Flutter", "Mobile"],
  titleNegativeKeywords: ["Intern"],
  locationAllowList: ["Remote"],
  locationBlockList: ["India"],
  salaryMin: 100000,
  salaryMax: 200000,
  salaryCurrency: "USD",
  trackedCompanies: [
    {
      id: "company_openai",
      name: "OpenAI",
      careersUrl: "https://openai.com/careers",
      provider: "websearch",
      enabled: true
    }
  ],
  searchQueries: [
    {
      id: "query_greenhouse_flutter",
      label: "Greenhouse Flutter",
      query: "site:boards.greenhouse.io Flutter",
      enabled: true
    }
  ],
  sourceRevision: "portals_sha256_0123abcd",
  updatedAt: "2026-06-26T05:00:00.000Z"
};

describe("Portal contract", () => {
  const { sourceRevision: _sourceRevision, updatedAt: _updatedAt, ...validSaveRequest } = validPortal;

  it("validates editable portal save requests without response metadata", () => {
    const request = SavePortalRequestDtoSchema.parse(validSaveRequest);

    expect(request).toMatchObject({
      titlePositiveKeywords: ["Flutter", "Mobile"],
      trackedCompanies: [{ name: "OpenAI" }],
      searchQueries: [{ label: "Greenhouse Flutter" }]
    });
    expect(request).not.toHaveProperty("sourceRevision");
    expect(request).not.toHaveProperty("updatedAt");
  });

  it("rejects invalid editable portal save requests", () => {
    expect(() =>
      SavePortalRequestDtoSchema.parse({ ...validSaveRequest, salaryMin: 300, salaryMax: 200 })
    ).toThrow();
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        salaryMin: 100,
        salaryCurrency: undefined
      })
    ).toThrow();
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        salaryMin: undefined,
        salaryMax: undefined,
        salaryCurrency: "USD"
      })
    ).toThrow();
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        trackedCompanies: [{ ...validSaveRequest.trackedCompanies[0], careersUrl: "ftp://example.com" }]
      })
    ).toThrow();
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        trackedCompanies: [{ ...validSaveRequest.trackedCompanies[0], provider: " " }]
      })
    ).toThrow();
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        searchQueries: [{ ...validSaveRequest.searchQueries[0], label: "" }]
      })
    ).toThrow();
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        trackedCompanies: [
          { ...validSaveRequest.trackedCompanies[0], id: "company_openai" },
          { ...validSaveRequest.trackedCompanies[0], id: "company_openai" }
        ]
      })
    ).toThrow();
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        searchQueries: [
          { ...validSaveRequest.searchQueries[0], id: "query_greenhouse" },
          { ...validSaveRequest.searchQueries[0], id: "query_greenhouse" }
        ]
      })
    ).toThrow();
  });

  it("rejects oversized portal save requests", () => {
    expect(() =>
      SavePortalRequestDtoSchema.parse({
        ...validSaveRequest,
        titlePositiveKeywords: ["x".repeat(PORTAL_CONFIG_MAX_BYTES)]
      })
    ).toThrow();
  });

  it("validates a normalized portal response", () => {
    expect(PortalDtoSchema.parse(validPortal)).toMatchObject({
      titlePositiveKeywords: ["Flutter", "Mobile"],
      trackedCompanies: [{ name: "OpenAI" }],
      searchQueries: [{ label: "Greenhouse Flutter" }]
    });
  });

  it("rejects invalid normalized portal fields", () => {
    expect(() =>
      PortalDtoSchema.parse({ ...validPortal, salaryMin: 200000, salaryMax: 100000 })
    ).toThrow();
    expect(() =>
      PortalDtoSchema.parse({ ...validPortal, salaryMin: 100000, salaryCurrency: undefined })
    ).toThrow();
    expect(() =>
      PortalDtoSchema.parse({
        ...validPortal,
        trackedCompanies: [{ ...validPortal.trackedCompanies[0], careersUrl: "not-a-url" }]
      })
    ).toThrow();
    expect(() =>
      PortalDtoSchema.parse({
        ...validPortal,
        searchQueries: [{ ...validPortal.searchQueries[0], query: "" }]
      })
    ).toThrow();
    expect(() =>
      PortalDtoSchema.parse({ ...validPortal, sourceRevision: "/tmp/portals.yml" })
    ).toThrow();
  });

  it("accepts HTTP URLs regardless of scheme casing", () => {
    expect(() =>
      PortalDtoSchema.parse({
        ...validPortal,
        trackedCompanies: [
          {
            ...validPortal.trackedCompanies[0],
            careersUrl: "HTTPS://example.com/jobs"
          }
        ]
      })
    ).not.toThrow();
  });

  it("validates checked-in portal examples", async () => {
    const portal = await readJsonFixture<unknown>("contracts/examples/portal.valid.json");
    const missing = await readJsonFixture<unknown>("contracts/examples/errors/portal-missing.json");
    const validation = await readJsonFixture<unknown>("contracts/examples/errors/validation.json");

    expect(PortalDtoSchema.parse(portal).sourceRevision).not.toContain("/");
    expect(() => ErrorResponseDtoSchema.parse(missing)).not.toThrow();
    expect(() => ErrorResponseDtoSchema.parse(validation)).not.toThrow();
  });
});
