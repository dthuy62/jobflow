package me.dthuy.jobflow.data.auth

import java.time.Clock
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
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.flatMap
import me.dthuy.jobflow.core.common.getOrNull
import me.dthuy.jobflow.core.common.mapLeft
import me.dthuy.jobflow.core.network.toRemoteError
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.auth.SignInMethod
import me.dthuy.jobflow.domain.auth.UserId
import timber.log.Timber

@Singleton
class AuthenticationServiceImpl @Inject constructor(
    private val store: SessionStore,
    private val tokens: SessionTokens,
    private val api: AuthApi,
    private val identity: IdentityProvider,
    private val installations: InstallationIdSource,
    private val clock: Clock,
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
            is SignInMethod.Google -> current()
                .flatMap { googleSession(method.idToken, guest = it?.takeIf(StoredSession::isGuest)) }
                .flatMap { keep(it) }
        }
        publish()
        result
    }

    override suspend fun signOut() = command {
        val current = store.read()
        // A guest has no sign-out: it would lose their data for good.
        if (current == null || current.isGuest) return@command
        tellTheBackend()
        store.clear()
        identity.signOut()
        publish()
    }

    private suspend fun startGuest(): Either<AuthError, Unit> = current().flatMap { current ->
        when {
            current != null -> Either.Right(Unit)
            store.isGuestUsed() -> Either.Left(AuthError.GuestAlreadyUsed)
            else -> guestSession().flatMap { keep(it) }
        }
    }

    // Each sign-in step only gets a session. The service keeps it, so a failure anywhere leaves the device as it was.

    private suspend fun guestSession(): Either<AuthError, StoredSession> =
        Either.catch(onError = Throwable::toRemoteError) {
            val answer = api.guest()
            answer.tokens.toStoredSession(answer.account, clock)
        }.mapLeft(DataSourceError::toAuthError)

    /** With [guest], the backend moves that guest's data to this account. It is safe to repeat after a lost answer. */
    private suspend fun googleSession(idToken: IdToken, guest: StoredSession?): Either<AuthError, StoredSession> =
        identity.signInWithGoogle(idToken).flatMap { proof ->
            Either.catch(onError = Throwable::toRemoteError) {
                val answer = api.sso(SsoRequest(proof.value, guest?.refreshToken))
                if (guest != null && !answer.guestMerged) Timber.w("The guest's data did not move to the account")
                answer.tokens.toStoredSession(answer.account, clock)
            }.mapLeft(DataSourceError::toAuthError)
        }

    /**
     * Best effort: signing out must work offline. Ends this session on the backend, and this install's push
     * registration when its id can be read.
     */
    private suspend fun tellTheBackend() {
        Either.catch(onError = { Timber.w(it, "Could not tell the backend about the sign-out") }) {
            api.logout(LogoutRequest(installations.id()))
        }
    }

    // Before a sign-in writes, it must see what is there: a guest it could not read would be lost for good.
    private suspend fun current(): Either<AuthError, StoredSession?> = Either.catch(
        onError = {
            Timber.w(it, "Could not read the session")
            AuthError.SignInFailed
        },
    ) { store.readOrThrow() }

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
        val read = Either.catch(onError = { Timber.w(it, "Could not read the session") }) { store.readOrThrow() }
        // A session that could not be read has not ended: everyone keeps seeing the last one.
        if (read is Either.Left && known) return
        val stored = read.getOrNull()
        // Marks on sight, not on creation, so a crash right after creating the guest cannot lose the mark.
        if (stored?.isGuest == true) store.markGuestUsed()
        val userId = stored?.userId
        if (!known || knownUserId != userId) {
            notifyObservers(userId)
            known = true
            knownUserId = userId
        }
        _session.value = when {
            stored == null -> Session.SignedOut(canStartGuest = !store.isGuestUsed())
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
