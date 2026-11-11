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
