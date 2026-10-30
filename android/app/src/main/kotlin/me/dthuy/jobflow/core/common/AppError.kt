package me.dthuy.jobflow.core.common

import kotlinx.coroutines.CancellationException

/**
 * The only error vocabulary the domain and presentation layers know about.
 * Data sources translate framework/SDK exceptions into one of these (see [toAppError]).
 */
sealed interface AppError {
    data object Network : AppError

    data class Storage(val cause: Throwable? = null) : AppError

    data class Engine(val cause: Throwable? = null) : AppError

    data class Unknown(val cause: Throwable? = null) : AppError
}

/** Never swallow [CancellationException]: structured concurrency depends on it propagating. */
fun Throwable.toAppError(): AppError {
    if (this is CancellationException) throw this
    return when (this) {
        is java.io.IOException -> AppError.Network
        else -> AppError.Unknown(this)
    }
}
