import { z } from "zod";
import { NameSchema, OpaqueIdSchema, TimestampSchema, WebUrlSchema, named } from "./common.js";
import { CurrencySchema, SalaryPeriodSchema } from "./preferences.js";

export const JobRemotePolicySchema = named("JobRemotePolicy", z.enum(["remote", "hybrid", "onsite", "unknown"]));

/** Only what the posting states; any part may be missing. */
const SalarySchema = z.strictObject({
  min: z.number().nonnegative().nullable(),
  max: z.number().nonnegative().nullable(),
  currency: CurrencySchema.nullable(),
  period: SalaryPeriodSchema.nullable()
});

export const JobSummaryDtoSchema = named(
  "JobSummaryDto",
  z.strictObject({
    jobId: OpaqueIdSchema,
    title: NameSchema,
    company: NameSchema,
    location: NameSchema.nullable(),
    remotePolicy: JobRemotePolicySchema,
    salary: SalarySchema.nullable(),
    url: WebUrlSchema,
    firstSeenAt: TimestampSchema,
    closed: z.boolean()
  })
);

export const JobDtoSchema = named(
  "JobDto",
  z.strictObject({
    ...JobSummaryDtoSchema.shape,
    source: NameSchema,
    /** The source's own id, in the source's format. */
    externalId: NameSchema.nullable(),
    /** ISO 3166-1 alpha-2, when the posting states them. */
    acceptedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)),
    acceptedTimezones: z.array(NameSchema),
    descriptionText: z.string().min(1).max(100_000),
    lastSeenAt: TimestampSchema
  })
);

export const CompanyCreateRequestSchema = named("CompanyCreateRequest", z.strictObject({ careersUrl: WebUrlSchema }));

/** Adding a company that is already indexed returns the same company. */
export const CompanyDtoSchema = named(
  "CompanyDto",
  z.strictObject({
    companyId: OpaqueIdSchema,
    name: NameSchema.nullable(),
    careersUrl: WebUrlSchema
  })
);

export type JobSummaryDto = z.infer<typeof JobSummaryDtoSchema>;
export type JobDto = z.infer<typeof JobDtoSchema>;
export type CompanyCreateRequest = z.infer<typeof CompanyCreateRequestSchema>;
export type CompanyDto = z.infer<typeof CompanyDtoSchema>;
