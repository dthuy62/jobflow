package me.dthuy.jobflow.domain.repository

import me.dthuy.jobflow.core.DataSourceError
import me.dthuy.jobflow.core.Either

interface JobFlowRepository {
    suspend fun getHealth(): Either<DataSourceError, Unit>
}
