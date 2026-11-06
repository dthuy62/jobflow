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

    /** Refused, interrupted or unexpected (already logged), and the session did not change: trying again can work. */
    data object SignInFailed : AuthError

    data object TooManyAttempts : AuthError

    data object AccountDisabled : AuthError

    /** This install already had its guest. */
    data object GuestAlreadyUsed : AuthError
}
