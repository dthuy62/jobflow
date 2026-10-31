import { z } from "zod";

const localPathPattern = /(^~\/|^\/|^[A-Za-z]:[\\/]|\.\.(?:[\\/]|$))/;

export const OpaqueIdSchema = z.string().trim().min(1).refine((value) => !localPathPattern.test(value), {
  message: "Value must not contain a local path."
});

export const SanitizedTextSchema = z.string().min(1).refine((value) => !localPathPattern.test(value), {
  message: "Value must not contain a local path."
});

export const SourceRevisionSchema = OpaqueIdSchema.optional();

export const CollectionDtoSchema = z.object({
  items: z.array(z.unknown()),
  syncedAt: z.iso.datetime(),
  sourceRevision: SourceRevisionSchema
});

export type CollectionDto = z.infer<typeof CollectionDtoSchema>;

/** Typed variant of {@link CollectionDtoSchema} for a concrete item contract. */
export function collectionDtoSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    items: z.array(item),
    syncedAt: z.iso.datetime(),
    sourceRevision: SourceRevisionSchema
  });
}
