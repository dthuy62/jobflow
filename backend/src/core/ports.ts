import type { UserId, VerifiedIdentity } from "./identity.js";

export interface AuthVerifier {
  /** Throws InvalidTokenError or AuthUnavailableError. */
  verify(token: string): Promise<VerifiedIdentity>;
}

export interface ResolvedUser {
  readonly id: UserId;
  readonly createdAt: Date;
  readonly deleted: boolean;
}

export interface UserRepository {
  /**
   * The user with this subject, created on first sight. A deleted user is returned as deleted, never revived.
   * The first token that is not anonymous marks the user as linked, so an old anonymous token of theirs cannot merge it away.
   */
  resolve(subject: string, isAnonymous: boolean): Promise<ResolvedUser>;
  /**
   * Moves a guest's data to this member and closes the guest, all or nothing. True when the data
   * is in this member now, also on a retry. False, with nothing changed, when it is the same user,
   * a linked user, a guest the server never saw, or a guest already closed some other way.
   */
  mergeGuest(guestSubject: string, memberId: UserId): Promise<boolean>;
}

export interface DeviceRepository {
  /** Removes this user's row only. Another user's row with the same installation id stays. */
  remove(userId: UserId, installationId: string): Promise<void>;
}
