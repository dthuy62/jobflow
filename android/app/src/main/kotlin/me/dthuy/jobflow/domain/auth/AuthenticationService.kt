package me.dthuy.jobflow.domain.auth

import kotlinx.coroutines.flow.StateFlow
import me.dthuy.jobflow.core.common.Either

/**
 * The one way in to authentication, and the one source of who is signed in. A session is the backend's, kept on the
 * device. A sign-in is all or nothing: on failure nothing changes, and a guest stays the guest they were. A session
 * that ends for any other reason is only a new [session] value, so screens need no code for it.
 */
interface AuthenticationService {
    val session: StateFlow<Session>

    /** A command is running, for every screen alike. */
    val isBusy: StateFlow<Boolean>

    /** Carries on if the caller goes away. A guest starts once per install, and not at all if someone is signed in. */
    suspend fun signIn(method: SignInMethod): Either<AuthError, Unit>

    /** A member only, and always on this device, even offline. A guest has no sign-out: it would lose their data. */
    suspend fun signOut()
}

/** Who is using the app, known offline. */
sealed interface Session {
    val isSignedIn: Boolean get() = false

    /** Not read from the device yet. */
    data object Unknown : Session

    /** A device install gets one guest, so after that only Google is left. */
    data class SignedOut(val canStartGuest: Boolean) : Session

    data class Guest(val userId: UserId) : Session {
        override val isSignedIn: Boolean get() = true
    }

    data class Member(val userId: UserId) : Session {
        override val isSignedIn: Boolean get() = true
    }
}

/** How a user can sign in. A new method does not compile until the service handles it. */
sealed interface SignInMethod {
    data object Guest : SignInMethod

    data class Google(val idToken: IdToken) : SignInMethod
}

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

/** The backend's id for a user. Kept on the device with the session, so it is known offline. */
@JvmInline
value class UserId(val value: String)

/** Proof of who signed in: from Google for the identity service, or from the identity service for the backend. */
@JvmInline
value class IdToken(val value: String) {
    // So a token cannot reach a log by accident.
    override fun toString(): String = "IdToken(***)"
}

/**
 * Lets the app react to a change of user without the auth code knowing what it stores. Register one with `@IntoSet`. It
 * runs before anyone sees the new session; a failure is logged and blocks neither the session nor other observers.
 */
fun interface SessionObserver {
    /** Runs when the user changes, also when a guest signs in with Google and their data moves. Null means nobody. */
    suspend fun onUserChanged(userId: UserId?)
}
