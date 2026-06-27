import { createHash } from "node:crypto";
import type { RuntimeConfig } from "../config/runtime-config.js";
import {
  PORTAL_CONFIG_MAX_BYTES,
  PortalDtoSchema,
  SavePortalRequestDtoSchema,
  type PortalDto,
  type SavePortalRequestDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { createPortalFileAdapter } from "../workspace/portal-file-adapter.js";

export interface PortalService {
  getPortals(): Promise<PortalDto>;
  savePortals(request: SavePortalRequestDto): Promise<PortalDto>;
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
    },

    async savePortals(request: SavePortalRequestDto): Promise<PortalDto> {
      const saveRequest = validateSaveRequest(request);
      const existingPortal = await readExistingPortalForSave(adapter);
      const mergedPortal = mergePortalSaveRequest(existingPortal, saveRequest);
      const file = await adapter.writePortalConfig(mergedPortal);

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

interface WritableStringRecord {
  [key: string]: unknown;
}

interface WritablePortalFileAdapter {
  readPortalConfig(): Promise<{ readonly parsedPortal: unknown }>;
  writePortalConfig(portal: unknown): Promise<{
    readonly parsedPortal: unknown;
    readonly sourceRevision: string;
    readonly updatedAt: string;
  }>;
}

function validateSaveRequest(request: SavePortalRequestDto): SavePortalRequestDto {
  if (Buffer.byteLength(JSON.stringify(request), "utf8") > PORTAL_CONFIG_MAX_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Portal config payload must be 128 KiB or smaller.");
  }

  const result = SavePortalRequestDtoSchema.safeParse(request);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Portal config is invalid.", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code
      }))
    });
  }

  return result.data;
}

async function readExistingPortalForSave(adapter: WritablePortalFileAdapter): Promise<WritableStringRecord> {
  try {
    const file = await adapter.readPortalConfig();
    normalizePortal(file.parsedPortal, {
      sourceRevision: "portals_sha256_00000000",
      updatedAt: new Date(0).toISOString()
    });
    return asWritableRecord(file.parsedPortal);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return {};
    }

    throw error;
  }
}

function mergePortalSaveRequest(
  existingPortal: WritableStringRecord,
  request: SavePortalRequestDto
): WritableStringRecord {
  const titleFilter = ensureRecord(existingPortal, "title_filter");
  titleFilter.positive = request.titlePositiveKeywords;
  titleFilter.negative = request.titleNegativeKeywords;

  const locationFilter = ensureRecord(existingPortal, "location_filter");
  const alwaysAllow = readStringArrayForMerge(locationFilter.always_allow);
  locationFilter.allow = request.locationAllowList.filter((value) => !alwaysAllow.includes(value));
  locationFilter.block = request.locationBlockList;

  const salaryFilter = ensureRecord(existingPortal, "salary_filter");
  delete salaryFilter.min;
  delete salaryFilter.max;
  delete salaryFilter.currency;
  if (request.salaryMin !== undefined) {
    salaryFilter.min = request.salaryMin;
  }
  if (request.salaryMax !== undefined) {
    salaryFilter.max = request.salaryMax;
  }
  if (request.salaryCurrency !== undefined) {
    salaryFilter.currency = request.salaryCurrency;
  }

  const existingCompanies = readWritableArray(existingPortal.tracked_companies);
  existingPortal.tracked_companies = request.trackedCompanies.map((company) =>
    mergeCompany(findMatchingCompany(existingCompanies, company), company)
  );

  const existingQueries = readWritableArray(existingPortal.search_queries);
  existingPortal.search_queries = request.searchQueries.map((query) =>
    mergeSearchQuery(findMatchingSearchQuery(existingQueries, query), query)
  );

  return existingPortal;
}

function ensureRecord(source: WritableStringRecord, key: string): WritableStringRecord {
  const existing = asWritableRecordOrUndefined(source[key]);
  if (existing) {
    return existing;
  }

  const record: WritableStringRecord = {};
  source[key] = record;
  return record;
}

function readWritableArray(source: unknown): WritableStringRecord[] {
  return Array.isArray(source)
    ? source
        .map((item) => asWritableRecordOrUndefined(item))
        .filter((item): item is WritableStringRecord => item !== undefined)
    : [];
}

function readStringArrayForMerge(source: unknown): string[] {
  return Array.isArray(source) ? source.filter((value): value is string => typeof value === "string") : [];
}

function findMatchingCompany(
  existingCompanies: readonly WritableStringRecord[],
  company: SavePortalRequestDto["trackedCompanies"][number]
): WritableStringRecord | undefined {
  return existingCompanies.find((existing) => {
    const sourceName = readOptionalString(existing.name);
    const sourceUrl = readOptionalString(existing.careers_url);
    const sourceId = readOptionalString(existing.id);
    const generatedId = sourceName && sourceUrl ? opaqueId("company", `${sourceName}:${sourceUrl}`) : undefined;

    return (
      (company.id !== undefined && (company.id === sourceId || company.id === generatedId)) ||
      (sourceName === company.name && sourceUrl === company.careersUrl)
    );
  });
}

function mergeCompany(
  existing: WritableStringRecord | undefined,
  company: SavePortalRequestDto["trackedCompanies"][number]
): WritableStringRecord {
  const record: WritableStringRecord = existing ? { ...existing } : {};
  const existingId = readOptionalString(existing?.id);

  if (existingId) {
    record.id = existingId;
  } else {
    delete record.id;
  }
  record.name = company.name;
  record.careers_url = company.careersUrl;
  if (company.provider !== undefined) {
    record.provider = company.provider;
  } else {
    delete record.provider;
  }
  record.enabled = company.enabled;

  return record;
}

function findMatchingSearchQuery(
  existingQueries: readonly WritableStringRecord[],
  query: SavePortalRequestDto["searchQueries"][number]
): WritableStringRecord | undefined {
  return existingQueries.find((existing) => {
    const sourceLabel = readOptionalString(existing.name);
    const sourceQuery = readOptionalString(existing.query);
    const sourceId = readOptionalString(existing.id);
    const generatedId = sourceLabel && sourceQuery ? opaqueId("query", `${sourceLabel}:${sourceQuery}`) : undefined;

    return (
      (query.id !== undefined && (query.id === sourceId || query.id === generatedId)) ||
      (sourceLabel === query.label && sourceQuery === query.query)
    );
  });
}

function mergeSearchQuery(
  existing: WritableStringRecord | undefined,
  query: SavePortalRequestDto["searchQueries"][number]
): WritableStringRecord {
  const record: WritableStringRecord = existing ? { ...existing } : {};
  const existingId = readOptionalString(existing?.id);

  if (existingId) {
    record.id = existingId;
  } else {
    delete record.id;
  }
  record.name = query.label;
  record.query = query.query;
  record.enabled = query.enabled;

  return record;
}

function asWritableRecord(source: unknown): WritableStringRecord {
  const record = asWritableRecordOrUndefined(source);
  if (!record) {
    throw new ApiError("VALIDATION_ERROR", "Portal config cannot be normalized.");
  }
  return record;
}

function asWritableRecordOrUndefined(source: unknown): WritableStringRecord | undefined {
  return typeof source === "object" && source !== null && !Array.isArray(source)
    ? (source as WritableStringRecord)
    : undefined;
}

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
