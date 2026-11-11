package me.dthuy.jobflow.data.auth

import kotlinx.serialization.Serializable
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.domain.auth.AuthError
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * The backend's auth endpoints. Guest, sign-in and refresh are public; logout carries the session's access token.
 * Calls throw on failure.
 */
interface AuthApi {
    @POST("api/v1/auth/guest")
    suspend fun guest(): GuestResponseDto

    @POST("api/v1/auth/sso")
    suspend fun sso(@Body request: SsoRequest): SsoResponseDto

    /**
     * Not suspending: it runs inside an OkHttp request that is waiting for a token, and a synchronous call needs no
     * free slot in OkHttp's dispatcher, which those waiting requests may all be holding.
     */
    @POST("api/v1/auth/refresh")
    fun refresh(@Body request: RefreshRequest): Call<SessionTokensDto>

    @POST("api/v1/auth/logout")
    suspend fun logout(@Body request: LogoutRequest)
}

@Serializable
data class MeDto(val userId: String, val isAnonymous: Boolean, val createdAt: String)

@Serializable
data class SessionTokensDto(val accessToken: String, val refreshToken: String, val expiresIn: Long) {
    override fun toString(): String = "SessionTokensDto(expiresIn=$expiresIn)"
}

@Serializable
data class GuestResponseDto(val tokens: SessionTokensDto, val account: MeDto)

@Serializable
data class SsoRequest(val idToken: String, val guestRefreshToken: String? = null) {
    override fun toString(): String = "SsoRequest(***)"
}

@Serializable
data class SsoResponseDto(val tokens: SessionTokensDto, val account: MeDto, val guestMerged: Boolean)

@Serializable
data class RefreshRequest(val refreshToken: String) {
    override fun toString(): String = "RefreshRequest(***)"
}

@Serializable
data class LogoutRequest(val installationId: String? = null)

/**
 * What a failed auth API call means for signing in. Only what changes what the user can do stays apart: no connection,
 * too many attempts, or a sign-in to try again. Exhaustive on purpose, so a new source error is a decision here.
 */
fun DataSourceError.toAuthError(): AuthError = when (this) {
    DataSourceError.Remote.Unreachable -> AuthError.Network
    is DataSourceError.Remote.Rejected ->
        if (code == ApiErrorCode.RATE_LIMITED) AuthError.TooManyAttempts else AuthError.SignInFailed
    DataSourceError.Remote.Unauthorized,
    is DataSourceError.Remote.ServerFailure,
    DataSourceError.Remote.InvalidResponse,
    DataSourceError.Local.StorageFailure,
    DataSourceError.Unknown,
    -> AuthError.SignInFailed
}
