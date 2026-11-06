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
import me.dthuy.jobflow.core.common.ApplicationScope
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.flatMap
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.auth.SignInMethod
import me.dthuy.jobflow.domain.auth.UserId
import timber.log.Timber

@Singleton
class AuthenticationServiceImpl @Inject constructor(
    private val store: SessionStore,
    private val tokens: SessionTokens,
    private val guestSignIn: GuestSignIn,
    private val googleSignIn: GoogleSignIn,
    private val identity: IdentityProvider,
    private val logout: BackendLogout,
    private val guests: GuestLedger,
    private val observers: Set<@JvmSuppressWildcards SessionObserver>,
    @ApplicationScope private val scope: CoroutineScope,
) : AuthenticationService {
    // Commands run one at a time, and a session the backend ends meanwhile waits for the running one.
    private val commands = Mutex()
    private val _session = MutableStateFlow<Session>(Session.Unknown)
    private val _isBusy = MutableStateFlow(false)
    private var known = false
    private var knownUserId: UserId? = null

    override val session: StateFlow<Session> = _session.asStateFlow()
    override val isBusy: StateFlow<Boolean> = _isBusy.asStateFlow()

    init {
        scope.launch {
            commands.withLock { publish() }
            tokens.ended.collect { commands.withLock { publish() } }
        }
    }

    override suspend fun signIn(method: SignInMethod): Either<AuthError, Unit> = command {
        val result = when (method) {
            SignInMethod.Guest -> startGuest()
            is SignInMethod.Google ->
                googleSignIn.signIn(method.idToken, guest = store.read()?.takeIf { it.isGuest }).flatMap { keep(it) }
        }
        publish()
        result
    }

    override suspend fun signOut() = command {
        val current = store.read()
        // A guest has no sign-out: it would lose their data for good.
        if (current == null || current.isGuest) return@command
        logout.tellTheBackend()
        store.clear()
        identity.signOut()
        publish()
    }

    private suspend fun startGuest(): Either<AuthError, Unit> = when {
        store.read() != null -> Either.Right(Unit)
        guests.isUsed() -> Either.Left(AuthError.GuestAlreadyUsed)
        else -> guestSignIn.signIn().flatMap { keep(it) }
    }

    // The new session replaces the old one in one write. If it cannot be written, the device keeps what it had: a guest
    // stays the guest, and repeating the sign-in is safe.
    private suspend fun keep(session: StoredSession): Either<AuthError, Unit> = Either.catch(
        onError = {
            Timber.w(it, "Could not keep the session")
            AuthError.SignInFailed
        },
    ) { store.save(session) }

    // On the app's scope, not the caller's: leaving the screen must not cut a sign-in before its session is kept.
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

    private suspend fun publish() {
        val stored = store.read()
        // Marks on sight, not on creation, so a crash right after creating the guest cannot lose the mark.
        if (stored?.isGuest == true) guests.markUsed()
        val userId = stored?.userId
        if (!known || knownUserId != userId) {
            notifyObservers(userId)
            known = true
            knownUserId = userId
        }
        _session.value = when {
            stored == null -> Session.SignedOut(canStartGuest = !guests.isUsed())
            stored.isGuest -> Session.Guest(stored.userId)
            else -> Session.Member(stored.userId)
        }
    }

    private suspend fun notifyObservers(userId: UserId?) {
        observers.forEach { observer ->
            Either.catch(onError = { Timber.w(it, "A session observer failed") }) { observer.onUserChanged(userId) }
        }
    }
}
