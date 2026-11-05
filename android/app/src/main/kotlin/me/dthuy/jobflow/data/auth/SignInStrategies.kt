package me.dthuy.jobflow.data.auth

import javax.inject.Inject
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.flatMap
import me.dthuy.jobflow.core.common.map
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken

/**
 * The identity provider and the backend share no transaction, so a sign-in is a saga: if the backend fails after the
 * provider succeeded, signing out on the device compensates. Never calls the logout API: the backend just failed, and
 * nothing is registered yet.
 */
private suspend fun IdentityProvider.confirmOrSignOut(confirm: suspend () -> Unit): Either<AuthError, Unit> {
    val result = Either.catch(onError = AuthApiErrorMapper::map) { confirm() }
    if (result is Either.Left) signOut()
    return result
}

class GuestSignIn @Inject constructor(private val identity: IdentityProvider, private val api: AuthApi) {
    suspend fun signIn(): Either<AuthError, Unit> = identity.startGuest().flatMap {
        identity.confirmOrSignOut { api.guest() }
    }
}

class GoogleSignIn @Inject constructor(
    private val identity: IdentityProvider,
    private val api: AuthApi,
    private val pending: PendingLogin,
) {
    suspend fun signIn(idToken: IdToken): Either<AuthError, Unit> =
        identity.signInWithGoogle(idToken).flatMap { result ->
            // Once switched there is no way back to the guest, so this token is the only proof left for a later retry.
            (result as? GoogleSignInResult.Switched)?.guestToken?.let(pending::keepGuestToken)
            identity.confirmOrSignOut { api.sso(SsoRequest(pending.guestToken())) }
                .map { pending.clearGuestToken() }
        }
}
