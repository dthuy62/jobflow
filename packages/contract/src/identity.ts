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

/** `isAnonymous` is true for a guest, whose data moves to a member at sign-in; a member's `userId` never changes. */
export const MeDtoSchema = named(
  "MeDto",
  z.strictObject({
    userId: OpaqueIdSchema,
    isAnonymous: z.boolean(),
    createdAt: TimestampSchema
  })
);

/**
 * The backend's session. `accessToken` is the Bearer for every other call. `expiresIn` is its life
 * in seconds from now: count it from when the answer arrived, not from the token's own `exp`, so
 * the device clock does not matter. `refreshToken` is opaque, has no fixed expiry and works once.
 */
export const SessionTokensDtoSchema = named(
  "SessionTokensDto",
  z.strictObject({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresIn: z.number().int().positive()
  })
);

export const GuestResponseDtoSchema = named("GuestResponseDto", z.strictObject({ tokens: SessionTokensDtoSchema, account: MeDtoSchema }));

/**
 * `idToken` is the identity provider's ID token (Firebase). `guestRefreshToken` is the guest's
 * current refresh token, whose data moves to this account. Any string is accepted there, because
 * a token that cannot merge must not fail the sign-in: `guestMerged` is false. The server's body
 * limit caps their size.
 */
export const SsoRequestSchema = named("SsoRequest", z.strictObject({ idToken: z.string(), guestRefreshToken: z.string().optional() }));

/** `guestMerged` says the guest's data is in this account now, also on a retry after a merge. */
export const SsoResponseDtoSchema = named(
  "SsoResponseDto",
  z.strictObject({ tokens: SessionTokensDtoSchema, account: MeDtoSchema, guestMerged: z.boolean() })
);

export const RefreshRequestSchema = named("RefreshRequest", z.strictObject({ refreshToken: z.string() }));

export const LogoutRequestSchema = named("LogoutRequest", z.strictObject({ installationId: OpaqueIdSchema }));

export type HealthDto = z.infer<typeof HealthDtoSchema>;
export type MeDto = z.infer<typeof MeDtoSchema>;
export type SessionTokensDto = z.infer<typeof SessionTokensDtoSchema>;
export type GuestResponseDto = z.infer<typeof GuestResponseDtoSchema>;
export type SsoRequest = z.infer<typeof SsoRequestSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type SsoResponseDto = z.infer<typeof SsoResponseDtoSchema>;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
