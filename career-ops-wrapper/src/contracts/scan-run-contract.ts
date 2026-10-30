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
