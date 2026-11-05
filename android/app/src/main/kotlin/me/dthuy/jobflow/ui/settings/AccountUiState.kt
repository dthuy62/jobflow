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
    val canSignIn: Boolean = false,
    val canRetry: Boolean = false,
    val canContinueAsGuest: Boolean = false,
) {
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
        is Session.SignedOut ->
            AccountUiState(AccountKind.SIGNED_OUT, canSignIn = true, canContinueAsGuest = session.canStartGuest)
        is Session.Guest -> AccountUiState(AccountKind.GUEST, canSignIn = true)
        is Session.Member -> AccountUiState(AccountKind.GOOGLE)
    }
    return when (activity) {
        AccountActivity.Idle -> idle
        AccountActivity.Running -> AccountUiState(AccountKind.LOADING)
        // Only a sign-in can fail for a member, so the button stays to try it again.
        is AccountActivity.ActionFailed -> idle.copy(error = activity.error, canSignIn = true)
        // A failed check says nothing once nobody is signed in, however it got here.
        is AccountActivity.CheckFailed -> if (!session.isSignedIn) {
            idle
        } else {
            idle.copy(
                error = activity.error,
                canSignIn = idle.canSignIn || activity.error.action == ErrorAction.SignIn,
                canRetry = activity.error.action == ErrorAction.Retry,
            )
        }
    }
}
