package me.dthuy.jobflow.testing

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.data.auth.AuthApi
import me.dthuy.jobflow.data.auth.GuestLedger
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.data.auth.IdentityUser
import me.dthuy.jobflow.data.auth.LogoutRequest
import me.dthuy.jobflow.data.auth.MeDto
import me.dthuy.jobflow.data.auth.PendingLogin
import me.dthuy.jobflow.data.auth.PendingSignIn
import me.dthuy.jobflow.data.auth.SsoRequest
import me.dthuy.jobflow.data.auth.SsoResponseDto
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SignInMethod
import me.dthuy.jobflow.domain.auth.Uid

val GUEST_USER = IdentityUser(Uid("uid_guest"), isAnonymous = true)
val LINKED_USER = IdentityUser(Uid("uid_guest"), isAnonymous = false)
val OTHER_USER = IdentityUser(Uid("uid_other"), isAnonymous = false)

/** Stays silent until something changes, like the real vendor before its first answer. */
class FakeIdentityProvider : IdentityProvider {
    private val users = MutableSharedFlow<IdentityUser?>(replay = 1)
    private val rejections = MutableSharedFlow<Uid>(extraBufferCapacity = 1)
    override val user: Flow<IdentityUser?> = users
    override val rejected: Flow<Uid> = rejections
    override var currentUser: IdentityUser? = null

    var guestFailure: AuthError? = null
    var googleFailure: AuthError? = null
    var guestTokenAtSwitch: String? = null
    var userAfterGoogle: IdentityUser = LINKED_USER
    var onSignInStart: suspend () -> Unit = {}
    val tokens = mutableListOf<IdToken>()
    var signOuts = 0

    suspend fun publish(user: IdentityUser?) {
        currentUser = user
        users.emit(user)
    }

    suspend fun reject(uid: Uid) = rejections.emit(uid)

    override suspend fun startGuest(): Either<AuthError, Unit> {
        onSignInStart()
        guestFailure?.let { return Either.Left(it) }
        publish(GUEST_USER)
        return Either.Right(Unit)
    }

    override suspend fun signInWithGoogle(
        idToken: IdToken,
        keepGuestToken: suspend (String) -> Unit,
    ): Either<AuthError, Unit> {
        onSignInStart()
        tokens += idToken
        guestTokenAtSwitch?.let { keepGuestToken(it) }
        googleFailure?.let { return Either.Left(it) }
        publish(userAfterGoogle)
        return Either.Right(Unit)
    }

    override suspend fun signOut() {
        signOuts++
        publish(null)
    }

    override fun idToken(forceRefresh: Boolean): String? = null
}

class FakeAuthApi : AuthApi {
    var failure: Exception? = null
    var gate: CompletableDeferred<Unit>? = null
    var guestCalls = 0
    val ssoRequests = mutableListOf<SsoRequest>()
    val logouts = mutableListOf<String>()
    var onLogout: () -> Unit = {}

    private val me = MeDto("user_1", isAnonymous = false, createdAt = "2026-11-05T00:00:00Z")

    override suspend fun guest(): MeDto {
        guestCalls++
        gate?.await()
        failure?.let { throw it }
        return me
    }

    override suspend fun sso(request: SsoRequest): SsoResponseDto {
        ssoRequests += request
        gate?.await()
        failure?.let { throw it }
        return SsoResponseDto(me, guestMerged = request.guestToken != null)
    }

    override suspend fun logout(request: LogoutRequest) {
        onLogout()
        logouts += request.installationId
        gate?.await()
        failure?.let { throw it }
    }
}

class FakeGuestLedger : GuestLedger {
    private var used = false

    override suspend fun isUsed() = used

    override suspend fun markUsed() {
        used = true
    }
}

class FakePendingLogin : PendingLogin {
    private var running: PendingSignIn? = null
    private var token: String? = null

    var canWrite = true

    override suspend fun running() = running

    override suspend fun begin(signIn: PendingSignIn): Boolean {
        if (canWrite) running = signIn
        return canWrite
    }

    override suspend fun finish() {
        running = null
    }

    override suspend fun guestToken() = token

    override suspend fun keepGuestToken(token: String) {
        this.token = token
    }

    override suspend fun clearGuestToken() {
        token = null
    }
}

/** Answers with [result]; set [gate] to hold a command in flight, during which [isBusy] is true. */
class FakeAuthenticationService(
    session: Session = Session.Guest(GUEST_USER.uid),
    var result: Either<AuthError, Unit> = Either.Right(Unit),
) : AuthenticationService {
    private val _session = MutableStateFlow(session)
    private val _isBusy = MutableStateFlow(false)
    override val session: StateFlow<Session> = _session
    override val isBusy: StateFlow<Boolean> = _isBusy

    val methods = mutableListOf<SignInMethod>()
    var signOuts = 0
    var gate: CompletableDeferred<Unit>? = null

    fun publish(session: Session) {
        _session.value = session
    }

    fun setBusy(busy: Boolean) {
        _isBusy.value = busy
    }

    override suspend fun signIn(method: SignInMethod): Either<AuthError, Unit> {
        methods += method
        _isBusy.value = true
        gate?.await()
        _isBusy.value = false
        if (result is Either.Right) {
            publish(if (method == SignInMethod.Guest) Session.Guest(GUEST_USER.uid) else Session.Member(OTHER_USER.uid))
        }
        return result
    }

    override suspend fun signOut() {
        signOuts++
        publish(Session.SignedOut(canStartGuest = false))
    }
}
