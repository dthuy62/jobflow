package me.dthuy.jobflow.data.auth

import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import me.dthuy.jobflow.core.common.unexpected
import me.dthuy.jobflow.domain.auth.AuthError
import retrofit2.HttpException
import timber.log.Timber

private const val HTTP_TOO_MANY_REQUESTS = 429

/** The sign-in API's error mapper. Any failure here fails the sign-in, so only what the user can act on differs. */
object AuthApiErrorMapper {
    fun map(error: Throwable): AuthError = when (error) {
        is CancellationException -> throw error
        is IOException -> AuthError.Network
        is HttpException -> {
            Timber.w(error, "The sign-in API refused")
            if (error.code() == HTTP_TOO_MANY_REQUESTS) AuthError.TooManyAttempts else AuthError.SignInFailed
        }
        is SerializationException -> {
            Timber.w(error, "The sign-in API's answer did not match the contract")
            AuthError.SignInFailed
        }
        else -> {
            unexpected(error)
            AuthError.Unknown
        }
    }
}
