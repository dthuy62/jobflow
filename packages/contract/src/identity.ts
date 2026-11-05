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

/**
 * The anonymous Firebase ID token from before this sign-in. Any string is accepted, because a bad
 * or expired token must not fail the sign-in: it only means `guestMerged` is false. The server's
 * body limit caps its size.
 */
export const SsoRequestSchema = named("SsoRequest", z.strictObject({ guestToken: z.string().optional() }));

/**
 * `guestMerged` says this call found the guest's data in this account. A retry of a merge that
 * worked is true again while `guestToken` is still valid; once it has expired the answer is false.
 */
export const SsoResponseDtoSchema = named("SsoResponseDto", z.strictObject({ account: MeDtoSchema, guestMerged: z.boolean() }));

export const LogoutRequestSchema = named("LogoutRequest", z.strictObject({ installationId: OpaqueIdSchema }));

export type HealthDto = z.infer<typeof HealthDtoSchema>;
export type MeDto = z.infer<typeof MeDtoSchema>;
export type SsoRequest = z.infer<typeof SsoRequestSchema>;
export type SsoResponseDto = z.infer<typeof SsoResponseDtoSchema>;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
