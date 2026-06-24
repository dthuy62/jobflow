package me.dthuy.jobflow.data.datasource

import me.dthuy.jobflow.data.database.JobFlowDatabase
import me.dthuy.jobflow.data.remote.JobFlowApiService
import retrofit2.Response


class JobFlowNetworkDataSource(private val api: JobFlowApiService) {
     suspend fun getHealth() = api.getHealth()
}


class JobFlowDatabaseDataSource(private val database: JobFlowDatabase)