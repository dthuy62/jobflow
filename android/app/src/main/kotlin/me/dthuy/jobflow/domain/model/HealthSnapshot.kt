package me.dthuy.jobflow.domain.model

import java.time.Instant
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.core.common.Either

/** One health check: what the API answered (or why it could not) and when, on the wall clock. */
data class HealthSnapshot(val result: Either<DataSourceError, Health>, val checkedAt: Instant)
