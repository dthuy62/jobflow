package me.dthuy.jobflow.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.fold
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthRepository
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session

private const val STOP_TIMEOUT_MS = 5_000L

/**
 * MVVM-lite: sign-in state and commands for any screen that offers them. Each screen gets its own instance, which is
 * safe because the session has one source, [AuthRepository].
 */
@HiltViewModel
class AuthViewModel @Inject constructor(private val authRepository: AuthRepository) : ViewModel() {
    private val activity = MutableStateFlow<AuthActivity>(AuthActivity.Idle)

    val uiState: StateFlow<AuthUiState> = combine(authRepository.session, activity, ::authUiState)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), AuthUiState())

    /**
     * Runs [requestToken] here and not in a screen's scope: rotating the screen would cancel that scope and drop the
     * result. A null token means the user closed Google's sheet, so everything stays as it was.
     *
     * A member signing in again can stay the same user, which changes no session, so [onSignedInAgain] is how a screen
     * learns to redo what it does on a session change.
     */
    fun onSignIn(onSignedInAgain: () -> Unit = {}, requestToken: suspend () -> Either<AuthError, IdToken?>) =
        runAction { before ->
            requestToken().fold(
                onLeft = { AuthActivity.Failed(it.toUiError()) },
                onRight = { token -> if (token == null) before else signIn(token, onSignedInAgain) },
            )
        }

    fun onContinueAsGuest() = runAction {
        authRepository.continueAsGuest().fold(
            onLeft = { AuthActivity.Failed(it.toUiError()) },
            onRight = { AuthActivity.Idle },
        )
    }

    fun onSignOut() = runAction {
        authRepository.signOut()
        AuthActivity.Idle
    }

    private suspend fun signIn(token: IdToken, onSignedInAgain: () -> Unit): AuthActivity {
        val wasMember = authRepository.session.value is Session.Member
        return authRepository.signInWithGoogle(token).fold(
            onLeft = { AuthActivity.Failed(it.toUiError()) },
            onRight = {
                if (wasMember) onSignedInAgain()
                AuthActivity.Idle
            },
        )
    }

    // Set before the first suspension, so a second tap cannot start a second action.
    private fun runAction(action: suspend (before: AuthActivity) -> AuthActivity) {
        val before = activity.value
        if (before == AuthActivity.Running) return
        activity.value = AuthActivity.Running
        viewModelScope.launch { activity.value = action(before) }.invokeOnCompletion {
            // A task cancelled from outside ends the action with no result, and Running would block all later ones.
            activity.update { if (it == AuthActivity.Running) before else it }
        }
    }
}
