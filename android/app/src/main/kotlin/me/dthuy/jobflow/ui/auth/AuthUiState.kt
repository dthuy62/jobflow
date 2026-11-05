package me.dthuy.jobflow.ui.auth

import androidx.compose.runtime.Immutable
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.domain.auth.Session

enum class AuthKind { LOADING, SIGNED_OUT, GUEST, MEMBER }

/** What a screen is doing with sign-in. Who the user is comes from the session alone. */
sealed interface AuthActivity {
    data object Idle : AuthActivity

    data object Running : AuthActivity

    /** A command failed, and the session did not change. The user tries again with the same button. */
    data class Failed(val error: UiError) : AuthActivity
}

@Immutable
data class AuthUiState(
    val kind: AuthKind = AuthKind.LOADING,
    val error: UiError? = null,
    val canSignIn: Boolean = false,
    val canContinueAsGuest: Boolean = false,
) {
    val isSignedIn: Boolean get() = kind == AuthKind.GUEST || kind == AuthKind.MEMBER
    val canSignOut: Boolean get() = kind == AuthKind.MEMBER
}

fun authUiState(session: Session, activity: AuthActivity): AuthUiState {
    val idle = when (session) {
        Session.Unknown -> AuthUiState(AuthKind.LOADING)
        is Session.SignedOut ->
            AuthUiState(AuthKind.SIGNED_OUT, canSignIn = true, canContinueAsGuest = session.canStartGuest)
        is Session.Guest -> AuthUiState(AuthKind.GUEST, canSignIn = true)
        is Session.Member -> AuthUiState(AuthKind.MEMBER)
    }
    return when (activity) {
        AuthActivity.Idle -> idle
        AuthActivity.Running -> AuthUiState(AuthKind.LOADING)
        // Only a sign-in can fail for a member, so the button stays to try it again.
        is AuthActivity.Failed -> idle.copy(error = activity.error, canSignIn = true)
    }
}
