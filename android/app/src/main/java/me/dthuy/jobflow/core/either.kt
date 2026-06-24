package me.dthuy.jobflow.core

import retrofit2.Response
import java.io.IOException
import kotlin.coroutines.cancellation.CancellationException

sealed class Either<out L, out R> {
    data class Left<out L>(val value: L) : Either<L, Nothing>()
    data class Right<out R>(val value: R) : Either<Nothing, R>()

    fun isLeft(): Boolean = this is Left
    fun isRight(): Boolean = this is Right
}

fun <L> L.left(): Either.Left<L> = Either.Left(this)
fun <R> R.right(): Either.Right<R> = Either.Right(this)

inline fun <L, R, T> Either<L, R>.fold(
    onLeft: (L) -> T,
    onRight: (R) -> T
): T = when (this) {
    is Either.Left -> onLeft(value)
    is Either.Right -> onRight(value)
}

sealed class DataSourceError

sealed class NetworkError : DataSourceError() {
    data class HttpError(
        val code: Int,
        val message: String
    ) : NetworkError()

    data class IOExceptionError(
        val throwable: IOException
    ) : NetworkError()

    data object EmptyBody : NetworkError()

    data class Unknown(
        val message: String? = null
    ) : NetworkError()
}

sealed class DatabaseError : DataSourceError()

suspend fun <T> attempt(
    call: suspend () -> Response<T>
): Either<DataSourceError, T> =
    runCatching { call() }
        .onFailure {
            if (it is CancellationException) throw it
        }
        .fold(
            onSuccess = { response ->
                if (response.isSuccessful) {
                    response.body()?.right()
                        ?: NetworkError.EmptyBody.left()
                } else {
                    NetworkError.HttpError(
                        code = response.code(),
                        message = response.message()
                    ).left()
                }
            },
            onFailure = { throwable ->
                when (throwable) {
                    is IOException -> NetworkError.IOExceptionError(throwable).left()
                    else -> NetworkError.Unknown(throwable.message).left()
                }
            }
        )