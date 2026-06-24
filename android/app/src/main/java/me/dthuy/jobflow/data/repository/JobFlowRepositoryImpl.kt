package me.dthuy.jobflow.data.repository

import me.dthuy.jobflow.core.DataSourceError
import me.dthuy.jobflow.core.Either
import me.dthuy.jobflow.core.attempt
import me.dthuy.jobflow.data.datasource.JobFlowDatabaseDataSource
import me.dthuy.jobflow.data.datasource.JobFlowNetworkDataSource
import me.dthuy.jobflow.domain.repository.JobFlowRepository

class JobFlowRepositoryImpl(
    private val networkDataSource: JobFlowNetworkDataSource,
    private val databaseDataSource: JobFlowDatabaseDataSource
) : JobFlowRepository {
    override suspend fun getHealth(): Either<DataSourceError, Unit> = attempt {
        networkDataSource.getHealth()
    }

}