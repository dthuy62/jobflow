package me.dthuy.jobflow.testing

import java.time.Instant
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.left
import me.dthuy.jobflow.domain.model.HealthSnapshot
import me.dthuy.jobflow.domain.repository.HealthRepository

val CHECKED_AT: Instant = Instant.parse("2026-10-30T02:05:00Z")

fun readySnapshot() = HealthSnapshot(Either.Right(healthFixture("health.ready.json")), CHECKED_AT)

fun notReadySnapshot() = HealthSnapshot(Either.Right(healthFixture("health.not-ready.json")), CHECKED_AT)

fun unreachableSnapshot() = HealthSnapshot(AppError.Unreachable.left(), CHECKED_AT)

/** Answers every refresh with [next]; set [gate] to hold a refresh in flight. */
class FakeHealthRepository(var next: HealthSnapshot = readySnapshot()) : HealthRepository {
    private val _latest = MutableStateFlow<HealthSnapshot?>(null)
    override val latest: StateFlow<HealthSnapshot?> = _latest

    val refreshes = mutableListOf<Boolean>()
    var gate: CompletableDeferred<Unit>? = null

    override suspend fun refresh(force: Boolean): HealthSnapshot {
        refreshes += force
        gate?.await()
        return next.also { _latest.value = it }
    }

    fun publish(snapshot: HealthSnapshot) {
        _latest.value = snapshot
    }
}
