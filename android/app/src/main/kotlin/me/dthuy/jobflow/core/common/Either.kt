package me.dthuy.jobflow.core.common

import kotlinx.coroutines.CancellationException

/**
 * Result of an operation that can fail in expected ways. By convention [Left] is the error and [Right] the value;
 * repositories return `Either<AppError, T>`. Prefer this over throwing across layers.
 */
sealed interface Either<out L, out R> {
    data class Left<out L>(val value: L) : Either<L, Nothing>

    data class Right<out R>(val value: R) : Either<Nothing, R>

    companion object
}

fun <L> L.left(): Either<L, Nothing> = Either.Left(this)

fun <R> R.right(): Either<Nothing, R> = Either.Right(this)

inline fun <L, R, T> Either<L, R>.fold(onLeft: (L) -> T, onRight: (R) -> T): T = when (this) {
    is Either.Left -> onLeft(value)
    is Either.Right -> onRight(value)
}

inline fun <L, R, T> Either<L, R>.map(transform: (R) -> T): Either<L, T> = when (this) {
    is Either.Left -> this
    is Either.Right -> Either.Right(transform(value))
}

inline fun <L, R, T> Either<L, R>.mapLeft(transform: (L) -> T): Either<T, R> = when (this) {
    is Either.Left -> Either.Left(transform(value))
    is Either.Right -> this
}

inline fun <L, R, T> Either<L, R>.flatMap(transform: (R) -> Either<L, T>): Either<L, T> = when (this) {
    is Either.Left -> this
    is Either.Right -> transform(value)
}

fun <R> Either<*, R>.getOrNull(): R? = (this as? Either.Right)?.value

fun <L> Either<L, *>.leftOrNull(): L? = (this as? Either.Left)?.value

/**
 * Runs [block] and turns a thrown exception into [Either.Left] with [onError], the data source's mapper.
 * [CancellationException] always propagates: structured concurrency depends on it.
 */
@Suppress("TooGenericExceptionCaught") // The one place that hands every exception to a source mapper.
suspend inline fun <L, R> Either.Companion.catch(onError: (Throwable) -> L, block: () -> R): Either<L, R> =
    try {
        Either.Right(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Either.Left(onError(e))
    }
