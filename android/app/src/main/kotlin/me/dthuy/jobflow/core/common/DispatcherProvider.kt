package me.dthuy.jobflow.core.common

import kotlinx.coroutines.CoroutineDispatcher

/** Inject this instead of touching `Dispatchers.*` so tests can swap in a test dispatcher. */
interface DispatcherProvider {
    val main: CoroutineDispatcher
    val default: CoroutineDispatcher
    val io: CoroutineDispatcher
}
