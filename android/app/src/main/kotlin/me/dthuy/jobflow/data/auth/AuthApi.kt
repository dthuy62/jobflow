package me.dthuy.jobflow.data.auth

import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.POST

/** The backend's sign-in endpoints. Calls throw on failure; every call carries the identity token as its bearer. */
interface AuthApi {
    @POST("api/v1/auth/guest")
    suspend fun guest(): MeDto

    @POST("api/v1/auth/sso")
    suspend fun sso(@Body request: SsoRequest): SsoResponseDto

    @POST("api/v1/auth/logout")
    suspend fun logout(@Body request: LogoutRequest)
}

@Serializable
data class MeDto(val userId: String, val isAnonymous: Boolean, val createdAt: String)

@Serializable
data class SsoRequest(val guestToken: String? = null)

@Serializable
data class SsoResponseDto(val account: MeDto, val guestMerged: Boolean)

@Serializable
data class LogoutRequest(val installationId: String)
