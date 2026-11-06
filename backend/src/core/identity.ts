/** A user's internal id. Only the auth service hands one out, from a verified session. */
export type UserId = string & { readonly __brand: "UserId" };
export type SessionId = string & { readonly __brand: "SessionId" };

/** Who the identity provider says signed in. */
export interface VerifiedIdentity {
  readonly subject: string;
  readonly isAnonymous: boolean;
}

export interface Account {
  readonly userId: UserId;
  /** A guest the backend created, with no provider sign-in yet. */
  readonly isAnonymous: boolean;
  readonly createdAt: Date;
}

export interface AuthenticatedUser extends Account {
  readonly sessionId: SessionId;
}

/** The token is bad: the app must sign in again. */
export class InvalidTokenError extends Error {
  constructor() {
    super("The token is not valid.");
    this.name = "InvalidTokenError";
  }
}

/** The token could not be checked: the app must retry and keep the user signed in. */
export class AuthUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The token could not be checked.", { cause });
    this.name = "AuthUnavailableError";
  }
}

/** The provider's token is valid but anonymous, which cannot make a member. */
export class SignInRequiredError extends Error {
  constructor() {
    super("A provider sign-in is required.");
    this.name = "SignInRequiredError";
  }
}
