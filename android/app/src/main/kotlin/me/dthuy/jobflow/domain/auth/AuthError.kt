package me.dthuy.jobflow.domain.auth

/**
 * Every way a sign-in command can fail. Each case changes what the user sees or can do; two that would not stay one.
 */
sealed interface AuthError {
    data object Network : AuthError

    /** The device has no Google account to offer. */
    data object NoGoogleAccount : AuthError

    /** Google sign-in cannot run on this device or build. */
    data object GoogleUnavailable : AuthError

    /** Google or Firebase refused or was interrupted, and the session did not change: trying again can work. */
    data object SignInFailed : AuthError

    data object TooManyAttempts : AuthError

    data object AccountDisabled : AuthError

    /** The identity service no longer accepts this user, so the session is over. */
    data object SessionEnded : AuthError

    /** This install already had its guest. */
    data object GuestAlreadyUsed : AuthError

    /** Something unexpected, already logged. */
    data object Unknown : AuthError
}
