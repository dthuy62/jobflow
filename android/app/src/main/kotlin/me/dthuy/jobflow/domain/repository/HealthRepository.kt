package me.dthuy.jobflow.domain.repository

import kotlinx.coroutines.flow.StateFlow
import me.dthuy.jobflow.domain.model.HealthSnapshot

interface HealthRepository {
    /** The last snapshot from any screen's refresh; `null` until the first check finishes. */
    val latest: StateFlow<HealthSnapshot?>

    /** Returns a fresh-enough snapshot, calling the wrapper only when the cache is stale, failed, or [force]d. */
    suspend fun refresh(force: Boolean = false): HealthSnapshot
}
