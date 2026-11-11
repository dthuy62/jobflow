package me.dthuy.jobflow.ui.auth

import androidx.compose.runtime.Immutable
import me.dthuy.jobflow.R
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.ErrorAction
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.core.mvi.UiIntent
import me.dthuy.jobflow.core.mvi.UiState
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session

enum class AuthKind { LOADING, SIGNED_OUT, GUEST, MEMBER }

@Immutable
data class AuthState(
    val kind: AuthKind = AuthKind.LOADING,
    val error: UiError? = null,
    val canSignIn: Boolean = false,
    val canContinueAsGuest: Boolean = false,
    val canSignOut: Boolean = false,
) : UiState

sealed interface AuthIntent : UiIntent {
    /** [requestToken] shows Google's sheet. A null token means the user closed it. */
    data class SignInWithGoogle(val requestToken: suspend () -> Either<AuthError, IdToken?>) : AuthIntent

    data object ContinueAsGuest : AuthIntent

    data object SignOut : AuthIntent
}

/** While anything runs, on this screen or another, nothing is offered: that is what keeps commands from overlapping. */
fun authState(session: Session, running: Boolean, error: UiError?): AuthState = when {
    running || session == Session.Unknown -> AuthState()
    session is Session.SignedOut -> AuthState(
        kind = AuthKind.SIGNED_OUT,
        error = error,
        canSignIn = true,
        canContinueAsGuest = session.canStartGuest,
    )
    session is Session.Guest -> AuthState(AuthKind.GUEST, error, canSignIn = true)
    // Only a sign-in can fail for a member, so the button stays while its error shows, to try it again.
    else -> AuthState(AuthKind.MEMBER, error, canSignIn = error != null, canSignOut = true)
}

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
