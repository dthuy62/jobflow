package me.dthuy.jobflow.data.remote

import kotlinx.serialization.SerializationException
import me.dthuy.jobflow.data.remote.dto.HealthDto
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.HttpException
import retrofit2.Response

private const val HTTP_SERVICE_UNAVAILABLE = 503

/**
 * The health body, including the one a 503 carries when a dependency is down: that is an answer, not a failure.
 * Any other failure throws with its body intact, so `toApiError` can still read the error code.
 */
fun Response<HealthDto>.healthOrThrow(): HealthDto {
    body()?.let { return it }
    val text = errorBody()?.string().orEmpty()
    if (code() == HTTP_SERVICE_UNAVAILABLE) text.toHealthOrNull()?.let { return it }
    throw HttpException(Response.error<HealthDto>(code(), text.toResponseBody()))
}

private fun String.toHealthOrNull(): HealthDto? = try {
    ApiJson.decodeFromString<HealthDto>(this)
} catch (_: SerializationException) {
    null
} catch (_: IllegalArgumentException) {
    null
}
