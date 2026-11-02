/** A user's internal id. Only the auth plugin makes one, from a verified token. */
export type UserId = string & { readonly __brand: "UserId" };

export interface VerifiedIdentity {
  readonly subject: string;
  readonly isAnonymous: boolean;
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
