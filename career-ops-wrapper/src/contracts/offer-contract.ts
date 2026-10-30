import { z } from "zod";
import { OpaqueIdSchema, SanitizedTextSchema, collectionDtoSchema } from "./shared-contract.js";

const offerUrlSchema = z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
  message: "url must use HTTP or HTTPS."
});

const optionalIsoDate = z.iso.datetime().nullable().optional();

export const OfferStatusSchema = z.enum(["new", "tracked", "applied", "rejected", "archived", "unknown"]);
/** `notEvaluated` marks offers found by a scan that desktop AI evaluation has not scored yet. */
export const OfferEvaluationStatusSchema = z.enum(["evaluated", "notEvaluated"]);
export const OfferWorkModeSchema = z.enum(["remote", "hybrid", "onsite", "flexible", "unknown"]);

export const OfferDtoSchema = z.object({
  id: OpaqueIdSchema,
  company: SanitizedTextSchema,
  title: SanitizedTextSchema,
  url: offerUrlSchema.nullable().optional(),
  location: SanitizedTextSchema.nullable().optional(),
  source: SanitizedTextSchema,
  status: OfferStatusSchema,
  firstSeenAt: optionalIsoDate,
  lastSeenAt: optionalIsoDate,
  scanRunId: OpaqueIdSchema.nullable().optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  salaryCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  workMode: OfferWorkModeSchema,
  evaluationStatus: OfferEvaluationStatusSchema.default("notEvaluated"),
  /** Career Ops `x/5` score mapped to 0–100 (`4.2/5` → 84). */
  score: z.number().min(0).max(100).nullable().optional(),
  reportId: OpaqueIdSchema.nullable().optional(),
  artifactIds: z.array(OpaqueIdSchema).default([]),
  rawSource: SanitizedTextSchema.nullable().optional(),
  notes: SanitizedTextSchema.nullable().optional(),
  warnings: z.array(SanitizedTextSchema).default([])
}).superRefine((value, context) => {
  const hasSalary = value.salaryMin !== undefined || value.salaryMax !== undefined;
  if (hasSalary && value.salaryCurrency === undefined) {
    context.addIssue({ code: "custom", path: ["salaryCurrency"], message: "salaryCurrency is required when salary bounds exist." });
  }
  if (value.salaryMin !== undefined && value.salaryMax !== undefined && value.salaryMax < value.salaryMin) {
    context.addIssue({ code: "custom", path: ["salaryMax"], message: "salaryMax must be greater than or equal to salaryMin." });
  }
});

export const OfferCollectionDtoSchema = collectionDtoSchema(OfferDtoSchema);

export type OfferDto = z.infer<typeof OfferDtoSchema>;
export type OfferCollectionDto = z.infer<typeof OfferCollectionDtoSchema>;
