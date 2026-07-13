package me.dthuy.jobflow.domain.repository

import me.dthuy.jobflow.core.DataSourceError
import me.dthuy.jobflow.core.Either
import me.dthuy.jobflow.domain.model.Health

interface JobFlowRepository {
    suspend fun getHealth(): Either<DataSourceError, Health>
}
