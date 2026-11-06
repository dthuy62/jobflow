import { createHash, randomBytes } from "node:crypto";
import { type Account, type AuthenticatedUser, InvalidTokenError, SignInRequiredError } from "./identity.js";
import type { AccessTokens, DeviceRepository, IdentityVerifier, SessionRepository, UserRepository } from "./ports.js";

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface SignedIn {
  readonly tokens: SessionTokens;
  readonly account: Account;
}

export interface AuthService {
  /** For the auth hook. Throws InvalidTokenError for a bad token, a revoked session, or a deleted or merged user. */
  authenticate(accessToken: string): Promise<AuthenticatedUser>;
  startGuest(): Promise<SignedIn>;
  /** Throws InvalidTokenError, SignInRequiredError or AuthUnavailableError. */
  signIn(idToken: string, guestRefreshToken?: string): Promise<SignedIn & { readonly guestMerged: boolean }>;
  /** Throws InvalidTokenError. */
  refresh(refreshToken: string): Promise<SessionTokens>;
  logout(user: AuthenticatedUser, installationId: string): Promise<void>;
}

export interface AuthServiceDeps {
  readonly identities: IdentityVerifier;
  readonly accessTokens: AccessTokens;
  readonly sessions: SessionRepository;
  readonly users: UserRepository;
  readonly devices: DeviceRepository;
}

const REFRESH_TOKEN_BYTES = 32;

/** Only this leaves the process; the database keeps the hash, so a leaked table signs no one in. */
const newRefreshToken = () => randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
export const hashRefreshToken = (token: string): Buffer => createHash("sha256").update(token).digest();

export function createAuthService({ identities, accessTokens, sessions, users, devices }: AuthServiceDeps): AuthService {
  const tokensFor = async (account: Pick<Account, "userId">, sessionId: AuthenticatedUser["sessionId"], refreshToken: string): Promise<SessionTokens> => ({
    accessToken: await accessTokens.issue(account.userId, sessionId),
    refreshToken,
    expiresIn: accessTokens.expiresInSeconds
  });

  return {
    async authenticate(accessToken) {
      const { userId, sessionId } = await accessTokens.verify(accessToken);
      const account = await sessions.findActive(sessionId, userId);
      if (!account) throw new InvalidTokenError();
      return { ...account, sessionId };
    },

    async startGuest() {
      const refreshToken = newRefreshToken();
      const { account, sessionId } = await sessions.startGuest(hashRefreshToken(refreshToken));
      return { tokens: await tokensFor(account, sessionId, refreshToken), account };
    },

    async signIn(idToken, guestRefreshToken) {
      const identity = await identities.verify(idToken);
      if (identity.isAnonymous) throw new SignInRequiredError();
      const { deleted, ...account } = await users.findOrCreateMember(identity.subject);
      if (deleted) throw new InvalidTokenError();
      // Before the new session, so a failure here leaves nothing behind, and a retry merges again or answers the same.
      const guestMerged = guestRefreshToken !== undefined && (await users.mergeGuest(hashRefreshToken(guestRefreshToken), account.userId));
      const refreshToken = newRefreshToken();
      const sessionId = await sessions.start(account.userId, hashRefreshToken(refreshToken));
      return { tokens: await tokensFor(account, sessionId, refreshToken), account, guestMerged };
    },

    async refresh(refreshToken) {
      const next = newRefreshToken();
      const rotated = await sessions.rotate(hashRefreshToken(refreshToken), hashRefreshToken(next));
      if (!rotated) throw new InvalidTokenError();
      return tokensFor(rotated, rotated.sessionId, next);
    },

    // The device row first: if revoking then fails, a retry still has a live token to send.
    async logout({ userId, sessionId }, installationId) {
      await devices.remove(userId, installationId);
      await sessions.revoke(sessionId, "logout");
    }
  };
}
