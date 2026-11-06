import type { Account, SessionId, UserId, VerifiedIdentity } from "./identity.js";

/** Checks an identity provider's ID token, such as Firebase's. */
export interface IdentityVerifier {
  /** Throws InvalidTokenError or AuthUnavailableError. */
  verify(idToken: string): Promise<VerifiedIdentity>;
}

/** The backend's own short-lived bearer tokens. */
export interface AccessTokens {
  readonly expiresInSeconds: number;
  issue(userId: UserId, sessionId: SessionId): Promise<string>;
  /** Checks only the token itself, not whether its session still holds. Throws InvalidTokenError. */
  verify(token: string): Promise<{ readonly userId: UserId; readonly sessionId: SessionId }>;
}

/** A refresh token is only ever seen here as its SHA-256. */
export interface SessionRepository {
  /** Creates a guest, its session and its first refresh token, all or nothing. */
  startGuest(tokenHash: Buffer): Promise<{ readonly account: Account; readonly sessionId: SessionId }>;
  start(userId: UserId, tokenHash: Buffer): Promise<SessionId>;
  /** The live session holding this refresh token: not revoked, and its user neither deleted nor merged. */
  findByRefreshToken(tokenHash: Buffer): Promise<{ readonly userId: UserId; readonly sessionId: SessionId } | undefined>;
  /** Idempotent. */
  revoke(sessionId: SessionId, reason: "logout"): Promise<void>;
  /** The account, when the session is live and its user is neither deleted nor merged. One query. */
  findActive(sessionId: SessionId, userId: UserId): Promise<Account | undefined>;
}

export interface UserRepository {
  /** The member with this provider subject, created on first sight. A deleted member comes back deleted, never revived. */
  findOrCreateMember(subject: string): Promise<Account & { readonly deleted: boolean }>;
  /**
   * Moves the data of the guest whose refresh token has this hash to this member, closes
   * the guest and revokes its sessions, all or nothing. True when the data is in this member now,
   * also on a retry. False, with nothing changed, for any other token.
   */
  mergeGuest(guestTokenHash: Buffer, memberId: UserId): Promise<boolean>;
}

export interface DeviceRepository {
  /** Removes this user's row only. Another user's row with the same installation id stays. */
  remove(userId: UserId, installationId: string): Promise<void>;
}
