package me.dthuy.jobflow.data.repository.impl

import java.time.Clock
import java.time.Duration
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.map
import me.dthuy.jobflow.data.remote.CareerOpsApi
import me.dthuy.jobflow.data.remote.dto.toDomain
import me.dthuy.jobflow.data.remote.toApiError
import me.dthuy.jobflow.domain.model.HealthSnapshot
import me.dthuy.jobflow.domain.repository.HealthRepository

/**
 * App-scoped so every screen shares one cache. Only successes are cached: a failed check is retried on the next
 * refresh, so starting the wrapper and tapping "Check again" recovers at once.
 */
@Singleton
class HealthRepositoryImpl @Inject constructor(private val api: CareerOpsApi, private val clock: Clock) :
    HealthRepository {
    private val _latest = MutableStateFlow<HealthSnapshot?>(null)
    override val latest: StateFlow<HealthSnapshot?> = _latest.asStateFlow()

    // Concurrent callers wait for the in-flight check and then reuse its result.
    private val mutex = Mutex()

    override suspend fun refresh(force: Boolean): HealthSnapshot = mutex.withLock {
        _latest.value?.takeIf { !force && it.isFreshSuccess() }
            ?: HealthSnapshot(
                result = Either.catch(onError = Throwable::toApiError) { api.getHealth() }.map { it.toDomain() },
                checkedAt = clock.instant(),
            ).also { _latest.value = it }
    }

    private fun HealthSnapshot.isFreshSuccess(): Boolean = result is Either.Right &&
        Duration.between(checkedAt, clock.instant()).toMillis() <= FRESHNESS_WINDOW_MILLIS

    companion object {
        const val FRESHNESS_WINDOW_MILLIS: Long = 3 * 60 * 60 * 1_000L
    }
}
