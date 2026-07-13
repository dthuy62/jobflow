package me.dthuy.jobflow.domain.usecase

import me.dthuy.jobflow.core.DataSourceError
import me.dthuy.jobflow.core.Either
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.domain.repository.JobFlowRepository

data class HealthCheckSnapshot(
    val result: Either<DataSourceError, Health>,
    val checkedAtMillis: Long,
)

class CheckHealthUseCase(
    private val repository: JobFlowRepository,
    private val clock: () -> Long = { System.nanoTime() / 1_000_000L },
) {
    private var cachedSnapshot: HealthCheckSnapshot? = null
    private var unhealthyDialogConsumed = false

    suspend operator fun invoke(forceRefresh: Boolean = false): HealthCheckSnapshot {
        val now = clock()
        val cached = cachedSnapshot
        if (!forceRefresh && cached != null && now - cached.checkedAtMillis <= FRESHNESS_WINDOW_MILLIS) {
            return cached
        }

        return HealthCheckSnapshot(
            result = repository.getHealth(),
            checkedAtMillis = now,
        ).also { cachedSnapshot = it }
    }

    fun shouldShowUnhealthyDialog(): Boolean = !unhealthyDialogConsumed && cachedSnapshot?.result.isUnhealthy()

    fun dismissUnhealthyDialog() {
        unhealthyDialogConsumed = true
    }

    companion object {
        const val FRESHNESS_WINDOW_MILLIS: Long = 3 * 60 * 60 * 1_000L
    }
}

private fun Either<DataSourceError, Health>?.isUnhealthy(): Boolean =
    when (this) {
        is Either.Left -> true
        is Either.Right -> value.status != HealthStatus.READY
        null -> false
    }
