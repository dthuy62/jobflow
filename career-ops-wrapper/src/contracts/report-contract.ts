import { z } from "zod";
import { OpaqueIdSchema, SanitizedTextSchema, collectionDtoSchema } from "./shared-contract.js";

export const REPORT_MARKDOWN_MAX_CHARS = 1024 * 1024;

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
  /**
   * Raw report Markdown with workspace/home paths redacted. Not a
   * SanitizedText: real reports contain relative links such as `../output/x.pdf`.
   */
  markdown: z.string().min(1).max(REPORT_MARKDOWN_MAX_CHARS)
});
export const ReportCollectionDtoSchema = collectionDtoSchema(ReportListItemDtoSchema);

export type ReportListItemDto = z.infer<typeof ReportListItemDtoSchema>;
export type ReportDetailDto = z.infer<typeof ReportDetailDtoSchema>;
export type ReportCollectionDto = z.infer<typeof ReportCollectionDtoSchema>;
