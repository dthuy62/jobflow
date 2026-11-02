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
  /** The user with this subject, created on first sight. A deleted user is returned as deleted, never revived. */
  resolve(subject: string): Promise<ResolvedUser>;
}
