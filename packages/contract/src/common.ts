import { z } from "zod";

/** Schemas named here become components in the generated OpenAPI document. */
export const contractRegistry = z.registry<{ id: string }>();

export function named<Schema extends z.ZodType>(id: string, schema: Schema): Schema {
  contractRegistry.add(schema, { id });
  return schema;
}

export const OpaqueIdSchema = z.string().trim().min(1).max(200);
export const TimestampSchema = z.iso.datetime();
export const NameSchema = z.string().trim().min(1).max(200);

export const WebUrlSchema = z.url({ protocol: /^https?$/ }).max(2048);

/** One page of a list. `nextCursor` is opaque and is null on the last page. */
export function pageSchema<Item extends z.ZodType>(item: Item) {
  return z.strictObject({
    items: z.array(item),
    nextCursor: OpaqueIdSchema.nullable()
  });
}
