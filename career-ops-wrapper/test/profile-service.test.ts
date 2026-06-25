import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime-config.js";
import { ProfileDtoSchema } from "../src/contracts/index.js";
import { ApiError } from "../src/errors/api-error.js";
import { createProfileService } from "../src/services/profile-service.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-profile-service-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  await mkdir(path.join(workspace, "config"), { recursive: true });
  return workspace;
}

function configFor(workspace: string): RuntimeConfig {
  return {
    host: "127.0.0.1",
    port: 3000,
    workspace
  };
}

const realProfileYaml = `target_roles:
  primary:
    - "Middle/Senior Flutter Developer"
    - "Junior/Middle Android Developer (Kotlin)"
  archetypes:
    - name: "Flutter Developer"
      level: "Middle/Senior"
narrative:
  headline: "Mobile Developer | Flutter & Android Kotlin"
  exit_story: "Building production mobile apps with AI-assisted workflows."
  superpowers:
    - "Cross-platform mobile development using Flutter & Dart"
    - "Android Kotlin development"
compensation:
  target_range: "25M - 45M VND"
  currency: "vnd"
  minimum: "20M VND"
  location_flexibility: "Da Nang only (On-site/Hybrid) or Remote from Da Nang for VN companies"
location:
  country: "Viet Nam"
  city: "Da Nang"
  visa_status: "No sponsorship needed"
unknown_top_level: "must not leak"
`;

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("Profile service", () => {
  it("normalizes real Career Ops profile YAML into ProfileDto fields", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "config/profile.yml"), realProfileYaml);

    const profile = await createProfileService(configFor(workspace)).getProfile();

    expect(ProfileDtoSchema.parse(profile)).toMatchObject({
      targetRoles: ["Middle/Senior Flutter Developer", "Junior/Middle Android Developer (Kotlin)"],
      seniorityLevel: "Middle/Senior",
      preferredLocations: [
        "Da Nang",
        "Viet Nam",
        "Da Nang only (On-site/Hybrid) or Remote from Da Nang for VN companies"
      ],
      remotePreference: "flexible",
      salaryMin: 20000000,
      salaryMax: 45000000,
      salaryCurrency: "VND",
      workAuthorizationNote: "No sponsorship needed",
      mustHaveSkills: [
        "Cross-platform mobile development using Flutter & Dart",
        "Android Kotlin development"
      ],
      niceToHaveSkills: [],
      excludedKeywords: []
    });
    expect(profile.positioningSummary).toContain("Mobile Developer");
    expect(profile.sourceRevision).toMatch(/^profile_sha256_[a-f0-9]{8}$/);
    expect(JSON.stringify(profile)).not.toContain("unknown_top_level");
  });

  it("rejects profiles without required source fields and leaves YAML untouched", async () => {
    const workspace = await createTempWorkspace();
    const profilePath = path.join(workspace, "config/profile.yml");
    const yaml = "target_roles:\n  primary: []\n";
    await writeFile(profilePath, yaml);

    await expect(createProfileService(configFor(workspace)).getProfile()).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
    await expect(readFile(profilePath, "utf8")).resolves.toBe(yaml);
  });

  it("rejects malformed required string arrays instead of dropping bad entries", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(
      path.join(workspace, "config/profile.yml"),
      `target_roles:
  primary: ["Senior Engineer", 123]
  archetypes:
    - level: "Senior"
location:
  city: "Remote"
`
    );

    await expect(createProfileService(configFor(workspace)).getProfile()).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
  });
});
