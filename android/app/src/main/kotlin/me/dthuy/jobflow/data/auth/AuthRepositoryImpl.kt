package me.dthuy.jobflow.data.auth

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import me.dthuy.jobflow.core.common.ApplicationScope
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthRepository
import me.dthuy.jobflow.domain.auth.GuestPolicy
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.auth.Uid
import timber.log.Timber

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val identity: IdentityProvider,
    private val guests: GuestLedger,
    private val observers: Set<@JvmSuppressWildcards SessionObserver>,
    @ApplicationScope scope: CoroutineScope,
) : AuthRepository {
    private val commands = Mutex()

    // Observers run before publishing, and for every cause of a change: an account deleted on the web runs no sign-out.
    override val session: StateFlow<Session> = identity.user
        .map { user ->
            // Marks on sight, not on creation, so a crash right after creating the guest cannot lose the mark.
            if (user?.isAnonymous == true) guests.markUsed()
            notifyObservers(user?.uid)
            user.toSession(canStartGuest = GuestPolicy.canStart(guests.isUsed(), signedIn = false))
        }
        .distinctUntilChanged()
        .stateIn(scope, SharingStarted.Eagerly, Session.Unknown)

    override suspend fun continueAsGuest(): Either<AuthError, Unit> = commands.withLock {
        if (GuestPolicy.canStart(guests.isUsed(), signedIn = session.value.isSignedIn)) {
            identity.signInAsGuest()
        } else {
            Either.Left(AuthError.GuestAlreadyUsed)
        }
    }

    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, Unit> =
        commands.withLock { identity.signInWithGoogle(idToken) }

    override suspend fun signOut() = commands.withLock { identity.signOut() }

    private suspend fun notifyObservers(uid: Uid?) {
        observers.forEach { observer ->
            Either.catch(onError = { Timber.w(it, "A session observer failed") }) { observer.onSessionChanged(uid) }
        }
    }
}

private fun IdentityUser?.toSession(canStartGuest: Boolean): Session = when {
    this == null -> Session.SignedOut(canStartGuest)
    isAnonymous -> Session.Guest(uid)
    else -> Session.Member(uid)
}
