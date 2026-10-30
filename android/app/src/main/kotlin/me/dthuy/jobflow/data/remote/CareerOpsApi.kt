package me.dthuy.jobflow.data.remote

import me.dthuy.jobflow.data.remote.dto.HealthDto
import retrofit2.http.GET

/**
 * Endpoints of the local Career Ops wrapper. Calls throw on failure; repositories wrap them with
 * `Either.catch(onError = Throwable::toApiError) { ... }`.
 */
interface CareerOpsApi {
    @GET("api/v1/health")
    suspend fun getHealth(): HealthDto
}
