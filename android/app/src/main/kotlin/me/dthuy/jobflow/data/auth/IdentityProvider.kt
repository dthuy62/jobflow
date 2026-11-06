package me.dthuy.jobflow.data.auth

import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken

/**
 * The boundary with the identity vendor, which only answers "who is this". The backend's session is the only one, so
 * the vendor keeps nothing on the device. Changing vendor means another implementation, in its own folder like
 * `data/auth/firebase`, and on the backend another `IdentityVerifier`.
 */
interface IdentityProvider {
    /** Turns Google's token into the vendor's ID token for the backend, signed out of the vendor again either way. */
    suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, IdToken>

    /** Forgets the Google account picked on this device, so the next sign-in asks again. Best effort. */
    suspend fun signOut()
}

/** Identifies this install of the app to the backend, which treats it as an opaque string. */
fun interface InstallationIdSource {
    /** Null if it cannot be read right now. */
    suspend fun id(): String?
}
