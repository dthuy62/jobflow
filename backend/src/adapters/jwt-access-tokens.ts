import { errors, jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { InvalidTokenError, type SessionId, type UserId } from "../core/identity.js";
import type { AccessTokens } from "../core/ports.js";

export interface SigningKey {
  readonly kid: string;
  readonly secret: string;
}

export const ACCESS_TOKEN_ISSUER = "jobflow-api";
export const ACCESS_TOKEN_AUDIENCE = "jobflow-app";
const LIFETIME_SECONDS = 15 * 60;
const CLOCK_TOLERANCE_SECONDS = 5;

/** Both go into uuid columns: a string that is not one would fail the query, and turn a bad token into a 503. */
const ClaimsSchema = z.object({ sub: z.uuid(), sid: z.uuid() });

/** HS256 with the first key; any listed key verifies, so a new key can sign before the old one leaves. */
export function createJwtAccessTokens(keys: readonly SigningKey[]): AccessTokens {
  const [signing] = keys;
  if (!signing) throw new Error("At least one signing key is required.");
  const encode = (secret: string) => new TextEncoder().encode(secret);
  const secrets = new Map(keys.map(({ kid, secret }) => [kid, encode(secret)]));
  const signingSecret = encode(signing.secret);

  return {
    expiresInSeconds: LIFETIME_SECONDS,

    issue: (userId, sessionId) =>
      new SignJWT({ sid: sessionId })
        .setProtectedHeader({ alg: "HS256", kid: signing.kid, typ: "JWT" })
        .setIssuer(ACCESS_TOKEN_ISSUER)
        .setAudience(ACCESS_TOKEN_AUDIENCE)
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${LIFETIME_SECONDS}s`)
        .sign(signingSecret),

    async verify(token) {
      try {
        const { payload } = await jwtVerify(
          token,
          ({ kid }) => {
            const secret = kid === undefined ? undefined : secrets.get(kid);
            if (!secret) throw new InvalidTokenError();
            return secret;
          },
          {
            issuer: ACCESS_TOKEN_ISSUER,
            audience: ACCESS_TOKEN_AUDIENCE,
            // Only this, so a token cannot pick `none` or another algorithm for itself.
            algorithms: ["HS256"],
            requiredClaims: ["sub", "sid", "iat", "exp"],
            // Also refuses an `iat` in the future.
            maxTokenAge: LIFETIME_SECONDS,
            clockTolerance: CLOCK_TOLERANCE_SECONDS
          }
        );
        const claims = ClaimsSchema.safeParse(payload);
        if (!claims.success) throw new InvalidTokenError();
        return { userId: claims.data.sub as UserId, sessionId: claims.data.sid as SessionId };
      } catch (error) {
        // Every check here is local, so any failure from jose is about the token.
        if (error instanceof errors.JOSEError || error instanceof InvalidTokenError) throw new InvalidTokenError();
        throw error;
      }
    }
  };
}
