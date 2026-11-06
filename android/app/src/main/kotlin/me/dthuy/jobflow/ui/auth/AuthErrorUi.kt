package me.dthuy.jobflow.ui.auth

import me.dthuy.jobflow.R
import me.dthuy.jobflow.core.common.ErrorAction
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.domain.auth.AuthError

/** Exhaustive on purpose: a new [AuthError] does not compile until it has a message. */
fun AuthError.toUiError(): UiError = when (this) {
    AuthError.Network -> UiError(R.string.error_auth_network, ErrorAction.Retry)
    AuthError.NoGoogleAccount -> UiError(R.string.error_auth_no_google_account, ErrorAction.None)
    AuthError.GoogleUnavailable -> UiError(R.string.error_auth_google_unavailable, ErrorAction.None)
    AuthError.SignInFailed -> UiError(R.string.error_auth_sign_in_failed, ErrorAction.Retry)
    AuthError.TooManyAttempts -> UiError(R.string.error_auth_too_many_attempts, ErrorAction.Retry)
    AuthError.AccountDisabled -> UiError(R.string.error_auth_account_disabled, ErrorAction.None)
    AuthError.GuestAlreadyUsed -> UiError(R.string.error_auth_guest_already_used, ErrorAction.SignIn)
}
