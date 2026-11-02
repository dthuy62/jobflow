import { z } from "zod";

/** Schemas named here become components in the generated OpenAPI document. */
export const contractRegistry = z.registry<{ id: string }>();

export function named<Schema extends z.ZodType>(id: string, schema: Schema): Schema {
  contractRegistry.add(schema, { id });
  return schema;
}

/** Ids are safe in a storage key and a log line: no separators, no leading dot, no newline. */
export const OPAQUE_ID_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$";
export const OpaqueIdSchema = z.string().regex(new RegExp(OPAQUE_ID_PATTERN));
export const TimestampSchema = z.iso.datetime();

/** Trimmed text with no NUL, which PostgreSQL cannot store. */
export function textSchema(maxChars: number) {
  return z.string().trim().min(1).max(maxChars).regex(/^[^\u0000]*$/);
}

export const NameSchema = textSchema(200);

/** A credential from a vendor, such as an FCM or Play purchase token. */
export const VendorTokenSchema = z.string().regex(/^[^\s\u0000]{1,4096}$/);

/**
 * http or https with no user info, so `https://jobs.example.com@evil.example` cannot pass
 * as a link to jobs.example.com. Browsers skip extra slashes and read `\\` as `/`, so the host
 * must start right after `//` and hold neither. Written out so the published schema states it too.
 */
export const WebUrlSchema = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .regex(/^[Hh][Tt][Tt][Pp][Ss]?:\/\/[^/\\?#@\s]+(?:[/?#]|$)/);

/** One page of a list. `nextCursor` is opaque and is null on the last page. */
export function pageSchema<Item extends z.ZodType>(item: Item) {
  return z.strictObject({
    items: z.array(item),
    nextCursor: OpaqueIdSchema.nullable()
  });
}
