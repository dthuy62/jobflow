import { z } from "zod";

export const CV_MARKDOWN_MAX_BYTES = 512 * 1024;

const CvMarkdownSchema = z
  .string()
  .min(1)
  .refine((markdown) => Buffer.byteLength(markdown, "utf8") <= CV_MARKDOWN_MAX_BYTES, {
    message: "CV Markdown must be 512 KiB or smaller."
  });

export const CvDtoSchema = z
  .object({
    markdown: CvMarkdownSchema,
    sizeBytes: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime().nullable().optional(),
    sourceRevision: z.string().min(1).optional()
  })
  .superRefine((value, context) => {
    if (value.sizeBytes !== Buffer.byteLength(value.markdown, "utf8")) {
      context.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: "sizeBytes must match the UTF-8 byte length of markdown."
      });
    }
  });

export const SaveCvRequestDtoSchema = z.object({
  markdown: CvMarkdownSchema.refine((markdown) => markdown.trim().length > 0, {
    message: "CV Markdown must not be blank."
  })
});

export type CvDto = z.infer<typeof CvDtoSchema>;
export type SaveCvRequestDto = z.infer<typeof SaveCvRequestDtoSchema>;
