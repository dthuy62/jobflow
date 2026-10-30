import { z } from "zod";
import { OpaqueIdSchema, SanitizedTextSchema } from "./shared-contract.js";

export const ReportKindSchema = z.enum(["evaluation", "summary", "notes", "unknown"]);

const ReportBaseSchema = z.object({
  id: OpaqueIdSchema,
  offerId: OpaqueIdSchema.nullable().optional(),
  title: SanitizedTextSchema,
  kind: ReportKindSchema,
  createdAt: z.iso.datetime().nullable().optional(),
  updatedAt: z.iso.datetime().nullable().optional(),
  sourceRevision: OpaqueIdSchema.optional()
});

export const ReportListItemDtoSchema = ReportBaseSchema;
export const ReportDetailDtoSchema = ReportBaseSchema.extend({
  markdown: SanitizedTextSchema
});

export type ReportListItemDto = z.infer<typeof ReportListItemDtoSchema>;
export type ReportDetailDto = z.infer<typeof ReportDetailDtoSchema>;
