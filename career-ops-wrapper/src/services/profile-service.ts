import type { RuntimeConfig } from "../config/runtime-config.js";
import { ProfileDtoSchema, type ProfileDto } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { createProfileFileAdapter } from "../workspace/profile-file-adapter.js";

export interface ProfileService {
  getProfile(): Promise<ProfileDto>;
}

export function createProfileService(config: RuntimeConfig): ProfileService {
  const adapter = createProfileFileAdapter(config.workspace);

  return {
    async getProfile(): Promise<ProfileDto> {
      const file = await adapter.readProfileConfig();
      return normalizeProfile(file.parsedProfile, {
        sourceRevision: file.sourceRevision,
        updatedAt: file.updatedAt
      });
    }
  };
}

interface ProfileMetadata {
  readonly sourceRevision: string;
  readonly updatedAt: string;
}

type StringRecord = Record<string, unknown>;

function normalizeProfile(source: unknown, metadata: ProfileMetadata): ProfileDto {
  const root = asRecord(source);
  const targetRoles = readStringArray(readPath(root, ["target_roles", "primary"]));
  const seniorityLevel = readSeniorityLevel(root, targetRoles);
  const preferredLocations = uniqueStrings([
    readOptionalString(readPath(root, ["location", "city"])),
    readOptionalString(readPath(root, ["location", "country"])),
    readOptionalString(readPath(root, ["compensation", "location_flexibility"]))
  ]);
  const salaryMin = parseFirstMoney(readOptionalString(readPath(root, ["compensation", "minimum"])));
  const salaryMax = parseLastMoney(
    readOptionalString(readPath(root, ["compensation", "target_range"]))
  );
  const salaryCurrency = readOptionalString(readPath(root, ["compensation", "currency"]))?.toUpperCase();
  const positioningSummary = buildPositioningSummary(
    readOptionalString(readPath(root, ["narrative", "headline"])),
    readOptionalString(readPath(root, ["narrative", "exit_story"]))
  );

  return parseProfileDto({
    targetRoles,
    seniorityLevel,
    preferredLocations,
    remotePreference: normalizeRemotePreference(
      readOptionalString(readPath(root, ["compensation", "location_flexibility"]))
    ),
    ...(salaryMin !== undefined ? { salaryMin } : {}),
    ...(salaryMax !== undefined ? { salaryMax } : {}),
    ...(salaryMin !== undefined || salaryMax !== undefined ? { salaryCurrency } : {}),
    ...optionalStringField("workAuthorizationNote", readPath(root, ["location", "visa_status"])),
    mustHaveSkills: readOptionalStringArray(readPath(root, ["narrative", "superpowers"])),
    niceToHaveSkills: [],
    excludedKeywords: [],
    ...(positioningSummary ? { positioningSummary } : {}),
    sourceRevision: metadata.sourceRevision,
    updatedAt: metadata.updatedAt
  });
}

function parseProfileDto(value: unknown): ProfileDto {
  const result = ProfileDtoSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Profile config cannot be normalized.");
  }

  return result.data;
}

function readSeniorityLevel(root: StringRecord, targetRoles: string[]): string {
  const archetypes = readPath(root, ["target_roles", "archetypes"]);
  if (Array.isArray(archetypes)) {
    const level = archetypes
      .map((item) => readOptionalString(readPath(item, ["level"])))
      .find((value) => value !== undefined);

    if (level) {
      return level;
    }
  }

  const roleText = targetRoles.join(" ").toLowerCase();
  const matches = ["junior", "middle", "senior", "staff"].filter((level) =>
    roleText.includes(level)
  );
  const match = matches[0];
  if (matches.length === 1 && match) {
    return match === "staff" ? "Staff" : capitalize(match);
  }

  throw new ApiError("VALIDATION_ERROR", "Profile config cannot be normalized.");
}

function normalizeRemotePreference(value: string | undefined): ProfileDto["remotePreference"] {
  if (!value) {
    return "unknown";
  }

  const lower = value.toLowerCase();
  const hasRemote = lower.includes("remote");
  const hasHybrid = lower.includes("hybrid");
  const hasOnsite = lower.includes("onsite") || lower.includes("on-site");
  const modes = [hasRemote, hasHybrid, hasOnsite].filter(Boolean).length;

  if (modes > 1) {
    return "flexible";
  }
  if (hasRemote) {
    return "remote";
  }
  if (hasHybrid) {
    return "hybrid";
  }
  if (hasOnsite) {
    return "onsite";
  }
  return "unknown";
}

function buildPositioningSummary(headline: string | undefined, exitStory: string | undefined): string | undefined {
  const summary = [headline, exitStory].filter(Boolean).join("\n\n");
  return summary.length > 0 && summary.length <= 2000 ? summary : headline;
}

function parseFirstMoney(value: string | undefined): number | undefined {
  return parseMoneyValues(value)[0];
}

function parseLastMoney(value: string | undefined): number | undefined {
  const values = parseMoneyValues(value);
  return values.at(-1);
}

function parseMoneyValues(value: string | undefined): number[] {
  if (!value) {
    return [];
  }

  return [...value.matchAll(/(\d+(?:\.\d+)?)\s*([mk])?/gi)].map((match) => {
    const amount = Number(match[1]);
    const suffix = match[2]?.toLowerCase();
    const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
    return Math.round(amount * multiplier);
  });
}

function readPath(source: unknown, pathParts: readonly string[]): unknown {
  return pathParts.reduce<unknown>((current, key) => asRecordOrUndefined(current)?.[key], source);
}

function asRecord(source: unknown): StringRecord {
  const record = asRecordOrUndefined(source);
  if (!record) {
    throw new ApiError("VALIDATION_ERROR", "Profile config cannot be normalized.");
  }
  return record;
}

function asRecordOrUndefined(source: unknown): StringRecord | undefined {
  return typeof source === "object" && source !== null && !Array.isArray(source)
    ? (source as StringRecord)
    : undefined;
}

function readStringArray(source: unknown): string[] {
  const values = readOptionalStringArray(source);
  if (values.length === 0) {
    throw new ApiError("VALIDATION_ERROR", "Profile config cannot be normalized.");
  }
  return values;
}

function readOptionalStringArray(source: unknown): string[] {
  if (source === undefined) {
    return [];
  }

  if (
    !Array.isArray(source) ||
    source.some((value) => typeof value !== "string" || value.trim().length === 0)
  ) {
    throw new ApiError("VALIDATION_ERROR", "Profile config cannot be normalized.");
  }

  return source;
}

function readOptionalString(source: unknown): string | undefined {
  return typeof source === "string" && source.trim().length > 0 ? source : undefined;
}

function uniqueStrings(values: ReadonlyArray<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => value !== undefined))];
}

function optionalStringField<K extends string>(key: K, value: unknown): Partial<Record<K, string>> {
  const stringValue = readOptionalString(value);
  return stringValue ? { [key]: stringValue } as Partial<Record<K, string>> : {};
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}
