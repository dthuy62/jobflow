package me.dthuy.jobflow.domain.auth

import kotlinx.coroutines.flow.StateFlow
import me.dthuy.jobflow.core.common.Either

/**
 * The one source of who is signed in. A failed command returns an error and leaves [session] as it was; a session that
 * changes for any other reason is only a new [session] value, so screens need no code for it.
 */
interface AuthRepository {
    val session: StateFlow<Session>

    /** Starts an anonymous user, if [GuestPolicy] allows it. Does nothing if someone is already signed in. */
    suspend fun continueAsGuest(): Either<AuthError, Unit>

    /** Keeps a guest's id by linking Google to it, or switches to the Google account if it already exists. */
    suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, Unit>

    /** Ends the session and tells every [SessionObserver]. It does not start a guest. */
    suspend fun signOut()
}
