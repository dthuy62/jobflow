package me.dthuy.jobflow.ui.settings

import androidx.compose.runtime.Immutable
import me.dthuy.jobflow.core.common.ErrorAction
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.domain.auth.Session

enum class AccountKind { LOADING, SIGNED_OUT, GUEST, GOOGLE }

/** What this screen is doing with the account. Who the user is comes from the session alone. */
sealed interface AccountActivity {
    data object Idle : AccountActivity

    data object Running : AccountActivity

    /** A sign-in or similar failed. The user tries again with the same button. */
    data class ActionFailed(val error: UiError) : AccountActivity

    /** The API could not confirm the account. The user is still who the session says. */
    data class CheckFailed(val error: UiError) : AccountActivity
}

@Immutable
data class AccountUiState(
    val kind: AccountKind = AccountKind.LOADING,
    val error: UiError? = null,
    val canRetry: Boolean = false,
    val canContinueAsGuest: Boolean = false,
) {
    val canSignIn: Boolean
        get() = kind == AccountKind.SIGNED_OUT || kind == AccountKind.GUEST || error?.action == ErrorAction.SignIn
    val canSignOut: Boolean get() = kind == AccountKind.GOOGLE
}

@Immutable
data class AccountActions(
    val onRetry: () -> Unit,
    val onSignIn: () -> Unit,
    val onContinueAsGuest: () -> Unit,
    val onSignOut: () -> Unit,
)

fun accountUiState(session: Session, activity: AccountActivity): AccountUiState {
    val idle = when (session) {
        Session.Unknown -> AccountUiState(AccountKind.LOADING)
        is Session.SignedOut -> AccountUiState(AccountKind.SIGNED_OUT, canContinueAsGuest = session.canStartGuest)
        is Session.Guest -> AccountUiState(AccountKind.GUEST)
        is Session.Member -> AccountUiState(AccountKind.GOOGLE)
    }
    return when (activity) {
        AccountActivity.Idle -> idle
        AccountActivity.Running -> AccountUiState(AccountKind.LOADING)
        is AccountActivity.ActionFailed -> idle.copy(error = activity.error)
        is AccountActivity.CheckFailed ->
            idle.copy(error = activity.error, canRetry = activity.error.action == ErrorAction.Retry)
    }
}
