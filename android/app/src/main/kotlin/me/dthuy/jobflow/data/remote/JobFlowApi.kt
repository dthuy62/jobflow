package me.dthuy.jobflow.data.remote

import me.dthuy.jobflow.data.remote.dto.HealthDto
import retrofit2.Response
import retrofit2.http.GET

/**
 * Endpoints of the hosted API (`contracts/` at the repo root). Calls throw on failure; repositories wrap them with
 * `Either.catch(onError = Throwable::toApiError) { ... }`.
 */
interface JobFlowApi {
    /** A [Response], because health answers 503 with a normal body when a dependency is down: see [healthOrThrow]. */
    @GET("api/v1/health")
    suspend fun getHealth(): Response<HealthDto>
}
