package me.dthuy.jobflow.data.remote

import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.toApiErrorCode
import me.dthuy.jobflow.core.common.unexpected
import me.dthuy.jobflow.data.remote.dto.ErrorResponseDto
import retrofit2.HttpException
import timber.log.Timber

private const val HTTP_UNAUTHORIZED = 401
private val CLIENT_ERRORS = 400..499

/**
 * The wrapper API's error mapper: the only code that knows Retrofit, OkHttp and serialization exception types.
 * Use it as `Either.catch(onError = Throwable::toApiError) { api.call() }`.
 */
fun Throwable.toApiError(): AppError = when (this) {
    is CancellationException -> throw this
    is HttpException -> toHttpError()
    is IOException -> AppError.Unreachable
    is SerializationException -> {
        Timber.w(this, "Wrapper response did not match the contract")
        AppError.InvalidResponse
    }
    else -> unexpected(this)
}

// The wrapper sends its stable error code with 4xx and 5xx statuses alike (WORKSPACE_UNHEALTHY is a 503), so the
// body is read for every failure; only a failure without a known code falls back to the status.
private fun HttpException.toHttpError(): AppError {
    val status = code()
    val wrapperCode = wrapperErrorCode().toApiErrorCode()
    return when {
        status == HTTP_UNAUTHORIZED -> AppError.Unauthorized
        wrapperCode != ApiErrorCode.UNKNOWN -> AppError.Rejected(wrapperCode)
        status in CLIENT_ERRORS -> AppError.Rejected(ApiErrorCode.UNKNOWN)
        else -> AppError.ServerFailure(status)
    }
}

private fun HttpException.wrapperErrorCode(): String? {
    val body = response()?.errorBody()?.string() ?: return null
    return try {
        ApiJson.decodeFromString<ErrorResponseDto>(body).error.code
    } catch (_: SerializationException) {
        null
    } catch (_: IllegalArgumentException) {
        null
    }
}
