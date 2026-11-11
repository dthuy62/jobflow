package me.dthuy.jobflow.data.auth

import java.time.Clock
import javax.inject.Inject
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.flatMap
import me.dthuy.jobflow.core.common.mapLeft
import me.dthuy.jobflow.core.network.toRemoteError
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import timber.log.Timber

// Each strategy only gets a session. The service keeps it, so a failure anywhere leaves the device as it was.

class GuestSignIn @Inject constructor(private val api: AuthApi, private val clock: Clock) {
    suspend fun signIn(): Either<AuthError, StoredSession> = Either.catch(onError = Throwable::toRemoteError) {
        val answer = api.guest()
        answer.tokens.toStoredSession(answer.account, clock)
    }.mapLeft(DataSourceError::toAuthError)
}

class GoogleSignIn @Inject constructor(
    private val identity: IdentityProvider,
    private val api: AuthApi,
    private val clock: Clock,
) {
    /** With [guest], the backend moves that guest's data to this account. It is safe to repeat after a lost answer. */
    suspend fun signIn(idToken: IdToken, guest: StoredSession?): Either<AuthError, StoredSession> =
        identity.signInWithGoogle(idToken).flatMap { proof ->
            Either.catch(onError = Throwable::toRemoteError) {
                val answer = api.sso(SsoRequest(proof.value, guest?.refreshToken))
                if (guest != null && !answer.guestMerged) Timber.w("The guest's data did not move to the account")
                answer.tokens.toStoredSession(answer.account, clock)
            }.mapLeft(DataSourceError::toAuthError)
        }
}

class BackendLogout @Inject constructor(private val api: AuthApi, private val installations: InstallationIdSource) {
    /**
     * Best effort: signing out must work offline. Ends this session on the backend, and this install's push
     * registration when its id can be read.
     */
    suspend fun tellTheBackend() {
        Either.catch(onError = { Timber.w(it, "Could not tell the backend about the sign-out") }) {
            api.logout(LogoutRequest(installations.id()))
        }
    }
}
