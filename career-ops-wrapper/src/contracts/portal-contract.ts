import { z } from "zod";

export const PORTAL_CONFIG_MAX_BYTES = 128 * 1024;

const nonBlankString = z.string().trim().min(1);
const portalUrl = z.string().url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
});

const portalCompanySchema = z.object({
  id: nonBlankString.optional(),
  name: nonBlankString,
  careersUrl: portalUrl,
  provider: nonBlankString.nullable().optional(),
  enabled: z.boolean()
});

const portalSearchQuerySchema = z.object({
  id: nonBlankString.optional(),
  label: nonBlankString,
  query: nonBlankString,
  enabled: z.boolean()
});

function validateSalaryFields(
  value: {
    readonly salaryMin?: number | undefined;
    readonly salaryMax?: number | undefined;
    readonly salaryCurrency?: string | undefined;
  },
  context: z.RefinementCtx
): void {
  const hasSalary = value.salaryMin !== undefined || value.salaryMax !== undefined;

  if (hasSalary && value.salaryCurrency === undefined) {
    context.addIssue({
      code: "custom",
      path: ["salaryCurrency"],
      message: "salaryCurrency is required when salary bounds exist."
    });
  }

  if (
    value.salaryMin !== undefined &&
    value.salaryMax !== undefined &&
    value.salaryMax < value.salaryMin
  ) {
    context.addIssue({
      code: "custom",
      path: ["salaryMax"],
      message: "salaryMax must be greater than or equal to salaryMin."
    });
  }

  if (!hasSalary && value.salaryCurrency !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["salaryCurrency"],
      message: "salaryCurrency requires salaryMin or salaryMax."
    });
  }
}

function validateUniqueItemIds(
  items: readonly { readonly id?: string | undefined }[],
  path: string,
  context: z.RefinementCtx
): void {
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (item.id === undefined) {
      return;
    }
    if (seen.has(item.id)) {
      context.addIssue({
        code: "custom",
        path: [path, index, "id"],
        message: "id must be unique."
      });
      return;
    }
    seen.add(item.id);
  });
}

export const PortalDtoSchema = z
  .object({
    titlePositiveKeywords: z.array(nonBlankString),
    titleNegativeKeywords: z.array(nonBlankString),
    locationAllowList: z.array(nonBlankString),
    locationBlockList: z.array(nonBlankString),
    salaryMin: z.number().int().nonnegative().optional(),
    salaryMax: z.number().int().nonnegative().optional(),
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
    trackedCompanies: z.array(portalCompanySchema),
    searchQueries: z.array(portalSearchQuerySchema),
    sourceRevision: z.string().regex(/^portals_sha256_[a-f0-9]{8}$/).optional(),
    updatedAt: z.iso.datetime().nullable().optional()
  })
  .superRefine((value, context) => {
    validateSalaryFields(value, context);
  });

export type PortalDto = z.infer<typeof PortalDtoSchema>;

export const SavePortalRequestDtoSchema = z
  .object({
    titlePositiveKeywords: z.array(nonBlankString),
    titleNegativeKeywords: z.array(nonBlankString),
    locationAllowList: z.array(nonBlankString),
    locationBlockList: z.array(nonBlankString),
    salaryMin: z.number().int().nonnegative().optional(),
    salaryMax: z.number().int().nonnegative().optional(),
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
    trackedCompanies: z.array(portalCompanySchema),
    searchQueries: z.array(portalSearchQuerySchema)
  })
  .superRefine((value, context) => {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > PORTAL_CONFIG_MAX_BYTES) {
      context.addIssue({
        code: "custom",
        message: "Portal config payload must be 128 KiB or smaller."
      });
    }

    validateSalaryFields(value, context);
    validateUniqueItemIds(value.trackedCompanies, "trackedCompanies", context);
    validateUniqueItemIds(value.searchQueries, "searchQueries", context);
  });

export type SavePortalRequestDto = z.infer<typeof SavePortalRequestDtoSchema>;
