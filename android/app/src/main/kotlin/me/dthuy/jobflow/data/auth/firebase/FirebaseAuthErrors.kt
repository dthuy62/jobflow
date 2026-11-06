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

/** Firebase Auth's error mapper: the only code that knows its exception types. Only auth uses Firebase Auth. */
fun Throwable.toAuthError(): AuthError = when (this) {
    is CancellationException -> throw this
    is FirebaseNetworkException -> AuthError.Network
    is FirebaseTooManyRequestsException -> AuthError.TooManyAttempts
    is FirebaseAuthInvalidUserException ->
        if (errorCode == ERROR_USER_DISABLED) AuthError.AccountDisabled else AuthError.SignInFailed
    is FirebaseException -> {
        Timber.w(this, "Firebase sign-in failed")
        AuthError.SignInFailed
    }
    else -> {
        unexpected(this)
        AuthError.SignInFailed
    }
}
