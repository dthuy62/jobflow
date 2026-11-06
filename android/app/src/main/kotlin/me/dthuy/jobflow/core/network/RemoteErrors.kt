package me.dthuy.jobflow.core.network

import java.io.IOException
import java.time.format.DateTimeParseException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.core.common.toApiErrorCode
import me.dthuy.jobflow.core.common.unexpected
import retrofit2.HttpException
import timber.log.Timber

private const val HTTP_UNAUTHORIZED = 401
private val CLIENT_ERRORS = 400..499

/**
 * The hosted API's error mapper: the only code that knows Retrofit, OkHttp and serialization exception types.
 * Use it as `Either.catch(onError = Throwable::toRemoteError) { api.call() }`, then translate for the feature if it has
 * its own failures.
 */
fun Throwable.toRemoteError(): DataSourceError = when (this) {
    is CancellationException -> throw this
    is HttpException -> toHttpError()
    is IOException -> DataSourceError.Remote.Unreachable
    is SerializationException, is DateTimeParseException -> {
        Timber.w(this, "API response did not match the contract")
        DataSourceError.Remote.InvalidResponse
    }
    else -> unexpected(this)
}

// The API sends its stable error code with 4xx and 5xx statuses alike (AUTH_UNAVAILABLE is a 503), so the
// body is read for every failure; only a failure without a known code falls back to the status.
private fun HttpException.toHttpError(): DataSourceError {
    val status = code()
    val apiCode = apiErrorCode().toApiErrorCode()
    return when {
        status == HTTP_UNAUTHORIZED -> DataSourceError.Remote.Unauthorized
        apiCode != ApiErrorCode.UNKNOWN -> DataSourceError.Remote.Rejected(apiCode)
        status in CLIENT_ERRORS -> DataSourceError.Remote.Rejected(ApiErrorCode.UNKNOWN)
        else -> DataSourceError.Remote.ServerFailure(status)
    }
}

private fun HttpException.apiErrorCode(): String? {
    val body = response()?.errorBody()?.string() ?: return null
    return try {
        ApiJson.decodeFromString<ErrorResponseDto>(body).error.code
    } catch (_: SerializationException) {
        null
    } catch (_: IllegalArgumentException) {
        null
    }
}
