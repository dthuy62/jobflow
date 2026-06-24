package me.dthuy.jobflow.data.remote

import retrofit2.Response
import retrofit2.http.GET

interface JobFlowApiService {
    @GET("/api/v1/health")
    suspend fun getHealth(): Response<Unit>
}