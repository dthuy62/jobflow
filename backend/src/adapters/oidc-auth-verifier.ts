import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { AuthUnavailableError, InvalidTokenError, type VerifiedIdentity } from "../core/identity.js";
import type { AuthVerifier } from "../core/ports.js";

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

const FIREBASE_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const LOOKUP_TIMEOUT_MS = 5_000;
/** What Firebase answers about a token or its user. Any other failure says nothing about them. */
const LOOKUP_BAD_TOKEN = new Set(["INVALID_ID_TOKEN", "USER_NOT_FOUND", "TOKEN_EXPIRED", "USER_DISABLED"]);
const LookupAnswerSchema = z.object({ users: z.array(z.object({ providerUserInfo: z.array(z.unknown()).optional() })).min(1) });
const LookupFailureSchema = z.object({ error: z.object({ message: z.string() }) });

/**
 * An anonymous user has no linked provider. Needs only a web API key, which grants nothing by itself:
 * the user's own token authorizes the call, so the server holds no Firebase admin credential.
 */
async function firebaseStillAnonymous(apiKey: string, token: string): Promise<boolean> {
  let status: number;
  let body: unknown;
  try {
    const response = await fetch(FIREBASE_LOOKUP_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
    });
    status = response.status;
    body = await response.json();
  } catch (error) {
    throw new AuthUnavailableError(error);
  }
  const answer = LookupAnswerSchema.safeParse(body);
  if (status === 200 && answer.success) return (answer.data.users[0]?.providerUserInfo ?? []).length === 0;
  const failure = LookupFailureSchema.safeParse(body);
  if (status === 400 && failure.success && LOOKUP_BAD_TOKEN.has(failure.data.error.message)) throw new InvalidTokenError();
  throw new AuthUnavailableError(new Error(`The Firebase lookup answered ${status}.`));
}

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
  readonly stillAnonymous: AuthVerifier["stillAnonymous"];
}

export function createOidcAuthVerifier({ issuer, audience, keys, isAnonymous, stillAnonymous }: OidcOptions): AuthVerifier {
  return {
    stillAnonymous,
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
        if (BAD_TOKEN_ERRORS.some((type) => error instanceof type)) throw new InvalidTokenError();
        throw new AuthUnavailableError(error);
      }
      const { sub, iat } = payload;
      // jose accepts a token issued in the future unless told its maximum age.
      if (!sub || sub.length > SUBJECT_MAX_CHARS || iat === undefined || iat > Date.now() / 1000 + CLOCK_TOLERANCE_SECONDS) {
        throw new InvalidTokenError();
      }
      return { subject: sub, isAnonymous: isAnonymous(payload) };
    }
  };
}

export function createFirebaseAuthVerifier(projectId: string, apiKey: string): AuthVerifier {
  return createOidcAuthVerifier({
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    keys: createRemoteJWKSet(new URL(FIREBASE_KEYS_URL), { cacheMaxAge: KEY_CACHE_MS }),
    isAnonymous: (payload) => (payload.firebase as { sign_in_provider?: unknown } | undefined)?.sign_in_provider === "anonymous",
    stillAnonymous: (token) => firebaseStillAnonymous(apiKey, token)
  });
}
