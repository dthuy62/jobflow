import { z } from "zod";

export const PROFILE_CONFIG_MAX_BYTES = 128 * 1024;

const nonBlankString = z.string().trim().min(1);
const nonBlankStringArray = z.array(nonBlankString).min(1);
const remotePreferenceSchema = z.enum(["remote", "hybrid", "onsite", "flexible", "unknown"]);

export const ProfileDtoSchema = z
  .object({
    targetRoles: z.array(z.string().min(1)).min(1),
    seniorityLevel: z.string().min(1),
    preferredLocations: z.array(z.string().min(1)).min(1),
    remotePreference: remotePreferenceSchema,
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

export const SaveProfileRequestDtoSchema = z
  .object({
    targetRoles: nonBlankStringArray,
    seniorityLevel: nonBlankString,
    preferredLocations: nonBlankStringArray,
    remotePreference: remotePreferenceSchema,
    salaryMin: z.number().int().nonnegative().optional(),
    salaryMax: z.number().int().nonnegative().optional(),
    salaryCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
    workAuthorizationNote: nonBlankString.optional(),
    mustHaveSkills: z.array(nonBlankString),
    niceToHaveSkills: z.array(nonBlankString).default([]),
    excludedKeywords: z.array(nonBlankString).default([]),
    positioningSummary: nonBlankString.max(2000).optional()
  })
  .superRefine((value, context) => {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > PROFILE_CONFIG_MAX_BYTES) {
      context.addIssue({
        code: "custom",
        message: "Profile config payload must be 128 KiB or smaller."
      });
    }

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

export type SaveProfileRequestDto = z.infer<typeof SaveProfileRequestDtoSchema>;
