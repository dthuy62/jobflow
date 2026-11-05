import type { UserId, VerifiedIdentity } from "./identity.js";

export interface AuthVerifier {
  /** Throws InvalidTokenError or AuthUnavailableError. */
  verify(token: string): Promise<VerifiedIdentity>;
  /**
   * Asks the provider whether this valid token's user is anonymous now. A token says what was true
   * when it was issued, and an anonymous one stays valid after the user links a real account.
   * Throws InvalidTokenError or AuthUnavailableError.
   */
  stillAnonymous(token: string): Promise<boolean>;
}

export interface ResolvedUser {
  readonly id: UserId;
  readonly createdAt: Date;
  readonly deleted: boolean;
}

export interface UserRepository {
  /** The user with this subject, created on first sight. A deleted user is returned as deleted, never revived. */
  resolve(subject: string): Promise<ResolvedUser>;
  /**
   * Moves a guest's data to this member and closes the guest, all or nothing. True when the data
   * is in this member now, also on a retry. False, with nothing changed, when it is the same user
   * or a guest already closed some other way. The caller checks first that the guest is anonymous.
   */
  mergeGuest(guestSubject: string, memberId: UserId): Promise<boolean>;
}

export interface DeviceRepository {
  /** Removes this user's row only. Another user's row with the same installation id stays. */
  remove(userId: UserId, installationId: string): Promise<void>;
}
