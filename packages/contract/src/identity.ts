import { z } from "zod";
import { OpaqueIdSchema, TimestampSchema, named } from "./common.js";

const CheckResultSchema = z.enum(["ok", "failed"]);

/** Health reports no version or host, because anyone can call it. */
export const HealthDtoSchema = named(
  "HealthDto",
  z
    .strictObject({
      status: z.enum(["ok", "degraded"]),
      checks: z.strictObject({ database: CheckResultSchema })
    })
    .refine(({ status, checks }) => (status === "ok") === (checks.database === "ok"), {
      message: "status must be ok only when every check is ok."
    })
);

/** `isAnonymous` is true until the user links a Google account; `userId` stays the same. */
export const MeDtoSchema = named(
  "MeDto",
  z.strictObject({
    userId: OpaqueIdSchema,
    isAnonymous: z.boolean(),
    createdAt: TimestampSchema
  })
);

export type HealthDto = z.infer<typeof HealthDtoSchema>;
export type MeDto = z.infer<typeof MeDtoSchema>;
