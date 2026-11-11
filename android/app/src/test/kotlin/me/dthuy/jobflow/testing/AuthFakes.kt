package me.dthuy.jobflow.testing

import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.data.auth.AuthApi
import me.dthuy.jobflow.data.auth.GuestLedger
import me.dthuy.jobflow.data.auth.GuestResponseDto
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.data.auth.LogoutRequest
import me.dthuy.jobflow.data.auth.MeDto
import me.dthuy.jobflow.data.auth.RefreshRequest
import me.dthuy.jobflow.data.auth.SessionStore
import me.dthuy.jobflow.data.auth.SessionTokensDto
import me.dthuy.jobflow.data.auth.SsoRequest
import me.dthuy.jobflow.data.auth.SsoResponseDto
import me.dthuy.jobflow.data.auth.StoredSession
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SignInMethod
import me.dthuy.jobflow.domain.auth.UserId
import okhttp3.Request
import okio.Timeout
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

val GUEST_ID = UserId("user_guest")
val MEMBER_ID = UserId("user_member")
val FIXED_CLOCK: Clock = Clock.fixed(Instant.parse("2026-11-06T00:00:00Z"), ZoneOffset.UTC)

fun storedSession(userId: UserId = GUEST_ID, isGuest: Boolean = true, expiresAt: Long = Long.MAX_VALUE) = StoredSession(
    userId = userId,
    isGuest = isGuest,
    accessToken = "access_${userId.value}",
    refreshToken = "refresh_${userId.value}",
    expiresAt = expiresAt,
)

class FakeSessionStore(var session: StoredSession? = null) : SessionStore {
    var canWrite = true
    var canRead = true

    override suspend fun read() = session.takeIf { canRead }

    override suspend fun readOrThrow(): StoredSession? {
        if (!canRead) throw IOException("cannot read")
        return session
    }

    override suspend fun save(session: StoredSession) {
        if (!canWrite) throw IOException("disk full")
        this.session = session
    }

    override suspend fun updateAccessToken(refreshToken: String, accessToken: String, expiresAt: Long) {
        session =
            session?.takeIf { it.refreshToken == refreshToken }?.copy(accessToken = accessToken, expiresAt = expiresAt)
                ?: session
    }

    override suspend fun clear(onlyIf: String?) {
        if (onlyIf == null || session?.refreshToken == onlyIf) session = null
    }
}

class FakeIdentityProvider : IdentityProvider {
    var failure: AuthError? = null
    val googleTokens = mutableListOf<IdToken>()
    var signOuts = 0

    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, IdToken> {
        googleTokens += idToken
        failure?.let { return Either.Left(it) }
        return Either.Right(IdToken("firebase_${idToken.value}"))
    }

    override suspend fun signOut() {
        signOuts++
    }
}

/** A backend that answers at once. Set [gate] to hold a call in flight. */
class FakeAuthApi : AuthApi {
    var failure: Exception? = null
    var gate: CompletableDeferred<Unit>? = null
    var guestCalls = 0
    val ssoRequests = mutableListOf<SsoRequest>()
    val logouts = mutableListOf<String?>()
    var onLogout: () -> Unit = {}
    val refreshes = mutableListOf<String>()
    var refreshAnswer: () -> Response<SessionTokensDto> = { Response.success(tokens(MEMBER_ID, "fresh")) }
    var memberId = MEMBER_ID

    override suspend fun guest(): GuestResponseDto {
        guestCalls++
        gate?.await()
        failure?.let { throw it }
        return GuestResponseDto(tokens(GUEST_ID), me(GUEST_ID, isAnonymous = true))
    }

    override suspend fun sso(request: SsoRequest): SsoResponseDto {
        ssoRequests += request
        gate?.await()
        failure?.let { throw it }
        return SsoResponseDto(tokens(memberId), me(memberId, isAnonymous = false), request.guestRefreshToken != null)
    }

    override fun refresh(request: RefreshRequest): Call<SessionTokensDto> {
        refreshes += request.refreshToken
        return AnsweredCall(refreshAnswer())
    }

    override suspend fun logout(request: LogoutRequest) {
        onLogout()
        logouts += request.installationId
        gate?.await()
        failure?.let { throw it }
    }

    private fun me(userId: UserId, isAnonymous: Boolean) = MeDto(userId.value, isAnonymous, "2026-11-06T00:00:00Z")
}

fun tokens(userId: UserId, access: String = "access_${userId.value}") =
    SessionTokensDto(accessToken = access, refreshToken = "refresh_${userId.value}", expiresIn = 900)

/** A Retrofit call that already has its answer. Only [execute] is used. */
private class AnsweredCall<T>(private val response: Response<T>) : Call<T> {
    override fun execute(): Response<T> = response

    override fun enqueue(callback: Callback<T>) = callback.onResponse(this, response)

    override fun isExecuted() = true

    override fun cancel() = Unit

    override fun isCanceled() = false

    override fun clone(): Call<T> = AnsweredCall(response)

    override fun request(): Request = Request.Builder().url("http://localhost/api/v1/auth/refresh").build()

    override fun timeout(): Timeout = Timeout.NONE
}

class FakeGuestLedger : GuestLedger {
    private var used = false

    override suspend fun isUsed() = used

    override suspend fun markUsed() {
        used = true
    }
}

/** Answers with [result]; set [gate] to hold a command in flight, during which [isBusy] is true. */
class FakeAuthenticationService(
    session: Session = Session.Guest(GUEST_ID),
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
            publish(if (method == SignInMethod.Guest) Session.Guest(GUEST_ID) else Session.Member(MEMBER_ID))
        }
        return result
    }

    override suspend fun signOut() {
        signOuts++
        publish(Session.SignedOut(canStartGuest = false))
    }
}
