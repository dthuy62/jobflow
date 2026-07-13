package me.dthuy.jobflow.data.datasource

import me.dthuy.jobflow.data.models.HealthDto
import me.dthuy.jobflow.data.remote.JobFlowApiService
import retrofit2.Response

class JobFlowNetworkDataSource(
    private val api: JobFlowApiService,
) {
    suspend fun getHealth(): Response<HealthDto> = api.getHealth()
}
