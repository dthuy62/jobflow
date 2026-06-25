import { z } from "zod";

export const ProfileDtoSchema = z
  .object({
    targetRoles: z.array(z.string().min(1)).min(1),
    seniorityLevel: z.string().min(1),
    preferredLocations: z.array(z.string().min(1)).min(1),
    remotePreference: z.enum(["remote", "hybrid", "onsite", "flexible", "unknown"]),
    salaryMin: z.number().int().nonnegative().optional(),
    salaryMax: z.number().int().nonnegative().optional(),
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
    workAuthorizationNote: z.string().min(1).optional(),
    mustHaveSkills: z.array(z.string().min(1)),
    niceToHaveSkills: z.array(z.string().min(1)),
    excludedKeywords: z.array(z.string().min(1)),
    positioningSummary: z.string().min(1).max(2000).optional(),
    sourceRevision: z.string().regex(/^profile_sha256_[a-f0-9]{8}$/).optional(),
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

export type ProfileDto = z.infer<typeof ProfileDtoSchema>;
