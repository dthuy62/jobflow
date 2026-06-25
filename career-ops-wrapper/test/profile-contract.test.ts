import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ErrorResponseDtoSchema, ProfileDtoSchema } from "../src/contracts/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonFixture<T>(relativePath: string): Promise<T> {
  const raw = await readFile(resolve(packageRoot, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

describe("Profile contract", () => {
  it("validates a checked-in profile response example", async () => {
    const example = await readJsonFixture<unknown>("contracts/examples/profile.valid.json");

    const profile = ProfileDtoSchema.parse(example);

    expect(profile.targetRoles).toHaveLength(2);
    expect(profile.sourceRevision).not.toContain("/");
  });

  it("rejects invalid MVP profile fields", () => {
    const valid = {
      targetRoles: ["Senior Engineer"],
      seniorityLevel: "Senior",
      preferredLocations: ["Remote"],
      remotePreference: "remote",
      mustHaveSkills: [],
      niceToHaveSkills: [],
      excludedKeywords: []
    };

    expect(() => ProfileDtoSchema.parse({ ...valid, targetRoles: [] })).toThrow();
    expect(() => ProfileDtoSchema.parse({ ...valid, remotePreference: "nomad" })).toThrow();
    expect(() => ProfileDtoSchema.parse({ ...valid, sourceRevision: "/tmp/profile.yml" })).toThrow();
    expect(() =>
      ProfileDtoSchema.parse({ ...valid, salaryMin: 200, salaryMax: 100, salaryCurrency: "USD" })
    ).toThrow();
    expect(() => ProfileDtoSchema.parse({ ...valid, salaryMin: 100 })).toThrow();
  });

  it.each([
    "contracts/examples/errors/profile-missing.json",
    "contracts/examples/errors/validation.json"
  ])("validates profile error example %s", async (fixturePath) => {
    const example = await readJsonFixture<unknown>(fixturePath);

    expect(() => ErrorResponseDtoSchema.parse(example)).not.toThrow();
  });
});
