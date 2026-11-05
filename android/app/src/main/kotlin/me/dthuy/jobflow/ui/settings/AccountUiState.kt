package me.dthuy.jobflow.ui.settings

import androidx.compose.runtime.Immutable
import me.dthuy.jobflow.core.common.ErrorAction
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.ui.auth.AuthKind
import me.dthuy.jobflow.ui.auth.AuthUiState

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
