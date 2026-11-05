package me.dthuy.jobflow.data.auth.firebase

import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import kotlinx.coroutines.CancellationException
import me.dthuy.jobflow.core.common.unexpected
import me.dthuy.jobflow.domain.auth.AuthError
import timber.log.Timber

private const val ERROR_USER_DISABLED = "ERROR_USER_DISABLED"

/** Firebase Auth's error mapper: the only code that knows its exception types. */
object FirebaseAuthErrorMapper {
    fun map(error: Throwable): AuthError = when (error) {
        is CancellationException -> throw error
        is FirebaseNetworkException -> AuthError.Network
        is FirebaseTooManyRequestsException -> AuthError.TooManyAttempts
        is FirebaseAuthInvalidUserException ->
            if (error.errorCode == ERROR_USER_DISABLED) AuthError.AccountDisabled else AuthError.SessionEnded
        is FirebaseException -> {
            Timber.w(error, "Firebase sign-in failed")
            AuthError.SignInFailed
        }
        else -> {
            unexpected(error)
            AuthError.Unknown
        }
    }
}
