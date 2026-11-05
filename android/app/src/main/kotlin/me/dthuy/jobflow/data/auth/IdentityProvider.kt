package me.dthuy.jobflow.data.auth

import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Uid

data class IdentityUser(val uid: Uid, val isAnonymous: Boolean)

sealed interface GoogleSignInResult {
    /** The guest became this account and kept their identity, so no data has to move. */
    data object Linked : GoogleSignInResult

    /** This is another account. [guestToken] proves who the guest was, if there was one, so the backend can merge. */
    data class Switched(val guestToken: String?) : GoogleSignInResult
}

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

    suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, GoogleSignInResult>

    /** On this device only: the backend is not told. */
    suspend fun signOut()
}

/** Identifies this install of the app to the backend, which treats it as an opaque string. */
fun interface InstallationIdSource {
    /** Null if it cannot be read right now. */
    suspend fun id(): String?
}
