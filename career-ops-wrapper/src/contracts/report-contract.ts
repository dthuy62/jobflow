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
   * Report Markdown. Links to workspace PDFs point at
   * `/api/v1/artifacts/{id}/download`, other local links become their text,
   * and local paths become `[local path]`. Not a SanitizedText: the text keeps
   * relative paths such as `output/x.pdf` that never leave the workspace.
   */
  markdown: z
    .string()
    .min(1)
    .max(REPORT_MARKDOWN_MAX_CHARS)
    .describe(
      "Report Markdown. Links to workspace PDFs point at `/api/v1/artifacts/{id}/download`; other local links become their text, and local paths become `[local path]`."
    )
});
export const ReportCollectionDtoSchema = collectionDtoSchema(ReportListItemDtoSchema);

export type ReportListItemDto = z.infer<typeof ReportListItemDtoSchema>;
export type ReportDetailDto = z.infer<typeof ReportDetailDtoSchema>;
export type ReportCollectionDto = z.infer<typeof ReportCollectionDtoSchema>;
