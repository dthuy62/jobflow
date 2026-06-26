import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ErrorResponseDtoSchema,
  PortalDtoSchema
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
