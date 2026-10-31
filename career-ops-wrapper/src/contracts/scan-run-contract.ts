import { z } from "zod";
import { OpaqueIdSchema, SanitizedTextSchema } from "./shared-contract.js";

export const ScanRunStatusSchema = z.enum(["pending", "running", "succeeded", "failed", "cancelled", "unknown"]);
export const ScanRunStageSchema = z.enum(["queued", "executing", "parsing", "projecting", "completed", "failed"]);

const ScanRunFailureSchema = z.object({
  code: SanitizedTextSchema,
  message: SanitizedTextSchema
});

export const ScanRunDtoSchema = z.object({
  id: OpaqueIdSchema,
  status: ScanRunStatusSchema,
  stage: ScanRunStageSchema,
  startedAt: z.iso.datetime().nullable().optional(),
  finishedAt: z.iso.datetime().nullable().optional(),
  exitCode: z.number().int().nullable().optional(),
  active: z.boolean(),
  summary: z.object({
    offersFound: z.number().int().nonnegative(),
    offersProjected: z.number().int().nonnegative(),
    warnings: z.array(SanitizedTextSchema)
  }),
  failure: ScanRunFailureSchema.nullable().optional(),
  sourceRevision: OpaqueIdSchema.optional()
});

export type ScanRunDto = z.infer<typeof ScanRunDtoSchema>;

export const SCAN_COMPANY_MAX_LENGTH = 100;

/** Company names forwarded as `scan.mjs --company <name>`; never a flag. */
export const ScanCompanySchema = z
  .string()
  .min(1)
  .max(SCAN_COMPANY_MAX_LENGTH)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .&'()+,-]*$/u, "company contains unsupported characters.");

export const StartScanRunRequestDtoSchema = z
  .object({
    dryRun: z.boolean().default(false),
    company: ScanCompanySchema.optional()
  })
  .strict();

export type StartScanRunRequestDto = z.infer<typeof StartScanRunRequestDtoSchema>;
