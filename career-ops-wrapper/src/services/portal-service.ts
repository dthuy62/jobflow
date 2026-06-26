import { createHash } from "node:crypto";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { PortalDtoSchema, type PortalDto } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { createPortalFileAdapter } from "../workspace/portal-file-adapter.js";

export interface PortalService {
  getPortals(): Promise<PortalDto>;
}

export function createPortalService(config: RuntimeConfig): PortalService {
  const adapter = createPortalFileAdapter(config.workspace);

  return {
    async getPortals(): Promise<PortalDto> {
      const file = await adapter.readPortalConfig();
      return normalizePortal(file.parsedPortal, {
        sourceRevision: file.sourceRevision,
        updatedAt: file.updatedAt
      });
    }
  };
}

interface PortalMetadata {
  readonly sourceRevision: string;
  readonly updatedAt: string;
}

type StringRecord = Record<string, unknown>;

function normalizePortal(source: unknown, metadata: PortalMetadata): PortalDto {
  const root = asRecord(source);
  const salaryMin = readOptionalNonNegativeInteger(readPath(root, ["salary_filter", "min"]));
  const salaryMax = readOptionalNonNegativeInteger(readPath(root, ["salary_filter", "max"]));
  const emittedSalaryMax = salaryMax === 0 ? undefined : salaryMax;
  const hasSalary = salaryMin !== undefined || emittedSalaryMax !== undefined;
  const salaryCurrency = readOptionalString(readPath(root, ["salary_filter", "currency"]))?.toUpperCase();

  return parsePortalDto({
    titlePositiveKeywords: readOptionalStringArray(readPath(root, ["title_filter", "positive"])),
    titleNegativeKeywords: readOptionalStringArray(readPath(root, ["title_filter", "negative"])),
    locationAllowList: uniqueStrings([
      ...readOptionalStringArray(readPath(root, ["location_filter", "always_allow"])),
      ...readOptionalStringArray(readPath(root, ["location_filter", "allow"]))
    ]),
    locationBlockList: readOptionalStringArray(readPath(root, ["location_filter", "block"])),
    ...(salaryMin !== undefined ? { salaryMin } : {}),
    ...(emittedSalaryMax !== undefined ? { salaryMax: emittedSalaryMax } : {}),
    ...(hasSalary ? { salaryCurrency } : {}),
    trackedCompanies: readTrackedCompanies(readPath(root, ["tracked_companies"])),
    searchQueries: readSearchQueries(readPath(root, ["search_queries"])),
    sourceRevision: metadata.sourceRevision,
    updatedAt: metadata.updatedAt
  });
}

function readTrackedCompanies(source: unknown): PortalDto["trackedCompanies"] {
  if (source === undefined) {
    return [];
  }
  if (!Array.isArray(source)) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }

  return source.map((item) => {
    const record = asRecord(item);
    const name = readRequiredString(record.name);
    const careersUrl = readRequiredString(record.careers_url);
    const provider = readNullableString(record.provider);
    return {
      id: readOptionalString(record.id) ?? opaqueId("company", `${name}:${careersUrl}`),
      name,
      careersUrl,
      ...(provider !== undefined ? { provider } : {}),
      enabled: readRequiredBoolean(record.enabled)
    };
  });
}

function readSearchQueries(source: unknown): PortalDto["searchQueries"] {
  if (source === undefined) {
    return [];
  }
  if (!Array.isArray(source)) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }

  return source.map((item) => {
    const record = asRecord(item);
    const label = readRequiredString(record.name);
    const query = readRequiredString(record.query);
    return {
      id: readOptionalString(record.id) ?? opaqueId("query", `${label}:${query}`),
      label,
      query,
      enabled: readRequiredBoolean(record.enabled)
    };
  });
}

function parsePortalDto(value: unknown): PortalDto {
  const result = PortalDtoSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }

  return result.data;
}

function readPath(source: unknown, pathParts: readonly string[]): unknown {
  return pathParts.reduce<unknown>((current, key) => {
    if (current === undefined) {
      return undefined;
    }

    const record = asRecordOrUndefined(current);
    if (!record) {
      throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
    }

    return record[key];
  }, source);
}

function asRecord(source: unknown): StringRecord {
  const record = asRecordOrUndefined(source);
  if (!record) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }
  return record;
}

function asRecordOrUndefined(source: unknown): StringRecord | undefined {
  return typeof source === "object" && source !== null && !Array.isArray(source)
    ? (source as StringRecord)
    : undefined;
}

function readOptionalStringArray(source: unknown): string[] {
  if (source === undefined) {
    return [];
  }

  if (
    !Array.isArray(source) ||
    source.some((value) => typeof value !== "string" || value.trim().length === 0)
  ) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }

  return source.map((value) => value.trim());
}

function readOptionalNonNegativeInteger(source: unknown): number | undefined {
  if (source === undefined) {
    return undefined;
  }
  if (typeof source !== "number" || !Number.isInteger(source) || source < 0) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }
  return source;
}

function readRequiredString(source: unknown): string {
  const value = readOptionalString(source);
  if (!value) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }
  return value;
}

function readOptionalString(source: unknown): string | undefined {
  if (source === undefined) {
    return undefined;
  }
  if (typeof source !== "string" || source.trim().length === 0) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }
  return source.trim();
}

function readNullableString(source: unknown): string | null | undefined {
  if (source === null) {
    return null;
  }
  return readOptionalString(source);
}

function readRequiredBoolean(source: unknown): boolean {
  if (typeof source !== "boolean") {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }
  return source;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function opaqueId(prefix: "company" | "query", value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 8)}`;
}
