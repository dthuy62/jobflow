package me.dthuy.jobflow.data.auth

import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Uid

data class IdentityUser(val uid: Uid, val isAnonymous: Boolean)

/**
 * The boundary with the identity vendor. Nothing above it knows how linking works, so changing that mechanism or the
 * vendor means replacing the implementation, which lives in `data/auth/firebase`.
 */
interface IdentityProvider : IdTokenSource {
    /** Emits when collected and on every change. */
    val user: Flow<IdentityUser?>

    val currentUser: IdentityUser?

    /** The vendor no longer accepts this user, found while fetching a token. The service decides what to do. */
    val rejected: Flow<Uid>

    suspend fun startGuest(): Either<AuthError, Unit>

    /**
     * Upgrades a guest and keeps their identity if it can. If this Google account already exists, the guest cannot be
     * reached again afterwards, so [guestTokens] gets the proof of who they were first, for the backend to merge.
     */
    suspend fun signInWithGoogle(idToken: IdToken, guestTokens: GuestTokenKeeper): Either<AuthError, Unit>

    /** On this device only: the backend is not told. */
    suspend fun signOut()
}

/** Identifies this install of the app to the backend, which treats it as an opaque string. */
fun interface InstallationIdSource {
    /** Null if it cannot be read right now. */
    suspend fun id(): String?
}
