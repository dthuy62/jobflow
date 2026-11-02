import { z } from "zod";
import { OpaqueIdSchema, TimestampSchema, named } from "./common.js";

export const CV_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const CV_MARKDOWN_MAX_CHARS = 200_000;

const CvMarkdownSchema = z.string().trim().min(1).max(CV_MARKDOWN_MAX_CHARS);

/** The extracted text, for the user to review and edit. It is stored only by `PUT /me/cv`. */
export const CvImportDtoSchema = named(
  "CvImportDto",
  z.strictObject({
    importId: OpaqueIdSchema,
    markdown: CvMarkdownSchema
  })
);

export const CvDtoSchema = named(
  "CvDto",
  z.strictObject({
    markdown: CvMarkdownSchema,
    updatedAt: TimestampSchema
  })
);

/** `importId` keeps the original file of that import; without it the text replaces the CV alone. */
export const CvUpdateRequestSchema = named(
  "CvUpdateRequest",
  z.strictObject({
    importId: OpaqueIdSchema.optional(),
    markdown: CvMarkdownSchema
  })
);

export type CvImportDto = z.infer<typeof CvImportDtoSchema>;
export type CvDto = z.infer<typeof CvDtoSchema>;
export type CvUpdateRequest = z.infer<typeof CvUpdateRequestSchema>;
