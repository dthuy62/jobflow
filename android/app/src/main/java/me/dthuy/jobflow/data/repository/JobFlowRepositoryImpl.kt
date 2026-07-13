package me.dthuy.jobflow.data.repository

import me.dthuy.jobflow.core.DataSourceError
import me.dthuy.jobflow.core.Either
import me.dthuy.jobflow.core.attemptMap
import me.dthuy.jobflow.data.datasource.JobFlowNetworkDataSource
import me.dthuy.jobflow.data.models.toDomain
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.repository.JobFlowRepository

class JobFlowRepositoryImpl(
    private val networkDataSource: JobFlowNetworkDataSource,
) : JobFlowRepository {
    override suspend fun getHealth(): Either<DataSourceError, Health> =
        attemptMap(
            call = { networkDataSource.getHealth() },
            transform = { it.toDomain() },
        )
}
