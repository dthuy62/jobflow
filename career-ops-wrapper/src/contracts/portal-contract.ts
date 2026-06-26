import { z } from "zod";

const nonBlankString = z.string().trim().min(1);

export const PortalDtoSchema = z
  .object({
    titlePositiveKeywords: z.array(nonBlankString),
    titleNegativeKeywords: z.array(nonBlankString),
    locationAllowList: z.array(nonBlankString),
    locationBlockList: z.array(nonBlankString),
    salaryMin: z.number().int().nonnegative().optional(),
    salaryMax: z.number().int().nonnegative().optional(),
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
    trackedCompanies: z.array(
      z.object({
        id: nonBlankString.optional(),
        name: nonBlankString,
        careersUrl: z.string().url().refine((value) => {
          const protocol = new URL(value).protocol;
          return protocol === "http:" || protocol === "https:";
        }),
        provider: nonBlankString.nullable().optional(),
        enabled: z.boolean()
      })
    ),
    searchQueries: z.array(
      z.object({
        id: nonBlankString.optional(),
        label: nonBlankString,
        query: nonBlankString,
        enabled: z.boolean()
      })
    ),
    sourceRevision: z.string().regex(/^portals_sha256_[a-f0-9]{8}$/).optional(),
    updatedAt: z.iso.datetime().nullable().optional()
  })
  .superRefine((value, context) => {
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
  });

export type PortalDto = z.infer<typeof PortalDtoSchema>;
