import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { AuthUnavailableError, InvalidTokenError, type VerifiedIdentity } from "../core/identity.js";
import type { IdentityVerifier } from "../core/ports.js";

const CLOCK_TOLERANCE_SECONDS = 5;
const SUBJECT_MAX_CHARS = 255;

const FIREBASE_KEYS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
/**
 * A cached key keeps working through an outage of the key endpoint. An unknown key id refetches,
 * at most every 30 seconds. So a token signed with a key published inside that window gets 401
 * until the next fetch; Google publishes keys ahead of use, and treating it as an outage would
 * let anyone with a forged key id write error logs.
 */
const KEY_CACHE_MS = 60 * 60 * 1000;

/** Errors that mean the token is bad. Anything else, such as a network failure, says nothing about the token. */
const BAD_TOKEN_ERRORS = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys
];

/** jose's code and the claim it refused: enough to tell a token from another project from an expired one. */
function refusal(error: errors.JOSEError): string {
  const { claim } = error as { claim?: unknown };
  return typeof claim === "string" ? `${error.code} ${claim}` : error.code;
}

/** An empty set says the key endpoint is wrong, not the token, so signing the user out would be wrong too. */
function hasNoKeys(keys: JWTVerifyGetKey): boolean {
  const { jwks } = keys as { jwks?: () => { keys: unknown[] } | undefined };
  return jwks?.()?.keys.length === 0;
}

export interface OidcOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly keys: JWTVerifyGetKey;
  readonly isAnonymous: (payload: JWTPayload) => boolean;
}

export function createOidcIdentityVerifier({ issuer, audience, keys, isAnonymous }: OidcOptions): IdentityVerifier {
  return {
    async verify(token): Promise<VerifiedIdentity> {
      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(token, keys, {
          issuer,
          audience,
          algorithms: ["RS256"],
          clockTolerance: CLOCK_TOLERANCE_SECONDS,
          requiredClaims: ["sub", "iat", "exp"]
        }));
      } catch (error) {
        if (error instanceof errors.JWKSNoMatchingKey && hasNoKeys(keys)) throw new AuthUnavailableError(error);
        if (BAD_TOKEN_ERRORS.some((type) => error instanceof type)) throw new InvalidTokenError(refusal(error as errors.JOSEError));
        throw new AuthUnavailableError(error);
      }
      const { sub, iat } = payload;
      // jose accepts a token issued in the future unless told its maximum age.
      if (!sub || sub.length > SUBJECT_MAX_CHARS || iat === undefined || iat > Date.now() / 1000 + CLOCK_TOLERANCE_SECONDS) {
        throw new InvalidTokenError("subject or iat out of range");
      }
      return { subject: sub, isAnonymous: isAnonymous(payload) };
    }
  };
}

export function createFirebaseIdentityVerifier(projectId: string): IdentityVerifier {
  return createOidcIdentityVerifier({
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    keys: createRemoteJWKSet(new URL(FIREBASE_KEYS_URL), { cacheMaxAge: KEY_CACHE_MS }),
    // Anonymous sign-in is off in the project; this refuses one anyway if it is turned back on.
    isAnonymous: (payload) => (payload.firebase as { sign_in_provider?: unknown } | undefined)?.sign_in_provider === "anonymous"
  });
}
