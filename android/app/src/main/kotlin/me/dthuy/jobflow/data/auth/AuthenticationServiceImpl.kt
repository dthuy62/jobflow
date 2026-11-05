package me.dthuy.jobflow.data.auth

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import me.dthuy.jobflow.core.common.ApplicationScope
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.auth.SignInMethod
import me.dthuy.jobflow.domain.auth.Uid
import timber.log.Timber

private const val LOGOUT_TIMEOUT_MS = 5_000L

@Singleton
class AuthenticationServiceImpl @Inject constructor(
    private val identity: IdentityProvider,
    private val guestSignIn: GuestSignIn,
    private val googleSignIn: GoogleSignIn,
    private val api: AuthApi,
    private val installations: InstallationIdSource,
    private val guests: GuestLedger,
    private val pending: PendingLogin,
    private val observers: Set<@JvmSuppressWildcards SessionObserver>,
    @ApplicationScope private val scope: CoroutineScope,
) : AuthenticationService {
    // Also what makes the provider's reports, and a session that ends meanwhile, wait for a running sign-in.
    private val commands = Mutex()
    private val _session = MutableStateFlow<Session>(Session.Unknown)
    private val _isBusy = MutableStateFlow(false)
    private var known = false
    private var knownUid: Uid? = null

    override val session: StateFlow<Session> = _session.asStateFlow()
    override val isBusy: StateFlow<Boolean> = _isBusy.asStateFlow()

    init {
        scope.launch {
            commands.withLock { rollBackInterruptedSignIn() }
            launch { identity.rejected.collect(::endRejected) }
            // Reads the current user once it has the lock: a report from the middle of a sign-in says nothing final.
            identity.user.collect { commands.withLock { publish() } }
        }
    }

    override suspend fun signIn(method: SignInMethod): Either<AuthError, Unit> = command {
        when (method) {
            SignInMethod.Guest -> startGuest()
            is SignInMethod.Google -> saga(PendingSignIn.GOOGLE) { googleSignIn.signIn(method.idToken) }
        }
    }

    override suspend fun signOut() = command {
        tellTheBackend()
        pending.clearGuestToken()
        identity.signOut()
        publish()
    }

    private suspend fun startGuest(): Either<AuthError, Unit> = when {
        identity.currentUser != null -> Either.Right(Unit)
        guests.isUsed() -> Either.Left(AuthError.GuestAlreadyUsed)
        else -> saga(PendingSignIn.GUEST) { guestSignIn.signIn() }
    }

    // The session only moves at the end, so nobody ever sees a user the backend has not confirmed.
    private suspend fun saga(
        kind: PendingSignIn,
        signIn: suspend () -> Either<AuthError, Unit>,
    ): Either<AuthError, Unit> {
        pending.begin(kind)
        // Finally skips a dead process, which is what the mark is for. A cancelled task must not leave the mark behind.
        val result = try {
            signIn()
        } finally {
            pending.finish()
            publish()
        }
        return result
    }

    // On the app's scope, not the caller's: leaving the screen must not cut a sign-in between provider and backend.
    private suspend fun <T> command(block: suspend () -> T): T = scope.async {
        commands.withLock {
            _isBusy.value = true
            try {
                block()
            } finally {
                _isBusy.value = false
            }
        }
    }.await()

    private suspend fun rollBackInterruptedSignIn() {
        val interrupted = pending.running() ?: return
        // Still anonymous during a Google sign-in means the provider never moved. Signing out would lose this guest for
        // good, with no token kept and no new guest allowed, so there is nothing to undo.
        val providerNeverMoved = interrupted == PendingSignIn.GOOGLE && identity.currentUser?.isAnonymous == true
        if (!providerNeverMoved) identity.signOut()
        pending.finish()
    }

    private suspend fun endRejected(uid: Uid) = commands.withLock {
        // It may be about a user who has already been replaced.
        if (identity.currentUser?.uid == uid) {
            identity.signOut()
            publish()
        }
    }

    // Best effort and bounded: signing out must work offline. Only removes this device's push registration.
    private suspend fun tellTheBackend() {
        withTimeoutOrNull(LOGOUT_TIMEOUT_MS) {
            Either.catch(onError = { Timber.w(it, "Could not tell the backend about the sign-out") }) {
                installations.id()?.let { api.logout(LogoutRequest(it)) }
            }
        }
    }

    private suspend fun publish() {
        val user = identity.currentUser
        // Marks on sight, not on creation, so a crash right after creating the guest cannot lose the mark.
        if (user?.isAnonymous == true) guests.markUsed()
        if (!known || knownUid != user?.uid) {
            notifyObservers(user?.uid)
            known = true
            knownUid = user?.uid
        }
        _session.value = user.toSession(canStartGuest = !guests.isUsed())
    }

    private suspend fun notifyObservers(uid: Uid?) {
        observers.forEach { observer ->
            Either.catch(onError = { Timber.w(it, "A session observer failed") }) { observer.onUserChanged(uid) }
        }
    }
}

private fun IdentityUser?.toSession(canStartGuest: Boolean): Session = when {
    this == null -> Session.SignedOut(canStartGuest)
    isAnonymous -> Session.Guest(uid)
    else -> Session.Member(uid)
}
