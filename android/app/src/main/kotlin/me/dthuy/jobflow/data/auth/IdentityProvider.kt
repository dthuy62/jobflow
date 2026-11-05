package me.dthuy.jobflow.data.auth

import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Uid

data class IdentityUser(val uid: Uid, val isAnonymous: Boolean)

/** Who the identity service says is signed in. A seam so the session's rules can be tested without Firebase. */
interface IdentityProvider {
    /** Emits the current user when collected and on every change; null means nobody is signed in. */
    val user: Flow<IdentityUser?>

    /** Does nothing if someone is already signed in. */
    suspend fun signInAsGuest(): Either<AuthError, Unit>

    /**
     * Links Google to a guest, who keeps their user id. A Google account already used here keeps its own data instead,
     * and the guest's data stays behind on the server.
     */
    suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, Unit>

    suspend fun signOut()
}
