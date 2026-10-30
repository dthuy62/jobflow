package me.dthuy.jobflow.core.common

import kotlinx.coroutines.CancellationException

/** Result type for operations that can fail in expected ways. Prefer this over throwing across layers. */
sealed interface Outcome<out T> {
    data class Success<T>(val value: T) : Outcome<T>

    data class Failure(val error: AppError) : Outcome<Nothing>
}

inline fun <T, R> Outcome<T>.map(transform: (T) -> R): Outcome<R> = when (this) {
    is Outcome.Success -> Outcome.Success(transform(value))
    is Outcome.Failure -> this
}

inline fun <T, R> Outcome<T>.fold(onSuccess: (T) -> R, onFailure: (AppError) -> R): R = when (this) {
    is Outcome.Success -> onSuccess(value)
    is Outcome.Failure -> onFailure(error)
}

/** Runs [block], converting thrown exceptions to [Outcome.Failure] using [onError]. */
@Suppress("TooGenericExceptionCaught") // This is the one place that turns any exception into an Outcome.
suspend inline fun <T> outcomeOf(
    onError: (Throwable) -> AppError = { it.toAppError() },
    block: () -> T,
): Outcome<T> =
    try {
        Outcome.Success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Outcome.Failure(onError(e))
    }
