package me.dthuy.jobflow.ui.settings

import androidx.compose.runtime.Immutable
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.ErrorAction
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.ui.auth.AuthKind
import me.dthuy.jobflow.ui.auth.AuthUiState
import me.dthuy.jobflow.ui.auth.AuthViewModel

/** Whether the API confirmed the signed-in user. Who they are comes from the session alone. */
sealed interface AccountCheck {
    data object Idle : AccountCheck

    data object Running : AccountCheck

    data class Failed(val error: UiError) : AccountCheck
}

@Immutable
data class AccountUiState(
    val kind: AuthKind = AuthKind.LOADING,
    val error: UiError? = null,
    val canSignIn: Boolean = false,
    val canRetry: Boolean = false,
    val canContinueAsGuest: Boolean = false,
    val canSignOut: Boolean = false,
)

@Immutable
data class AccountActions(
    val onRetry: () -> Unit,
    val onSignIn: () -> Unit,
    val onContinueAsGuest: () -> Unit,
    val onSignOut: () -> Unit,
)

/** Wires the card to both ViewModels. A member signing in again changes no session, so this asks the API again. */
fun accountActions(
    settings: SettingsViewModel,
    auth: AuthViewModel,
    requestToken: suspend () -> Either<AuthError, IdToken?>,
) = AccountActions(
    onRetry = settings::onRetryAccount,
    onSignIn = { auth.onSignIn(onSignedInAgain = settings::onRetryAccount, requestToken = requestToken) },
    onContinueAsGuest = auth::onContinueAsGuest,
    onSignOut = auth::onSignOut,
)

/** A check says nothing once nobody is signed in, however it got here. A running one offers no button. */
fun accountUiState(auth: AuthUiState, check: AccountCheck): AccountUiState {
    if (auth.isSignedIn && check == AccountCheck.Running) return AccountUiState()
    val failed = (check as? AccountCheck.Failed)?.error?.takeIf { auth.isSignedIn }
    return AccountUiState(
        kind = auth.kind,
        error = auth.error ?: failed,
        canSignIn = auth.canSignIn || failed?.action == ErrorAction.SignIn,
        canRetry = auth.error == null && failed?.action == ErrorAction.Retry,
        canContinueAsGuest = auth.canContinueAsGuest,
        canSignOut = auth.canSignOut,
    )
}
