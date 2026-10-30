import { z } from "zod";
import { OpaqueIdSchema, SanitizedTextSchema } from "./shared-contract.js";

const artifactDownloadUrlSchema = z.string().refine((value) => {
  if (value.startsWith("/api/v1/")) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "downloadUrl must be API-relative or an HTTP(S) URL.");

export const ArtifactDtoSchema = z.object({
  id: OpaqueIdSchema,
  offerId: OpaqueIdSchema.nullable().optional(),
  reportId: OpaqueIdSchema.nullable().optional(),
  filename: SanitizedTextSchema,
  contentType: SanitizedTextSchema,
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  downloadUrl: artifactDownloadUrlSchema,
  createdAt: z.iso.datetime().optional(),
  sourceRevision: OpaqueIdSchema.optional()
});

export type ArtifactDto = z.infer<typeof ArtifactDtoSchema>;
