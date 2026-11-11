package me.dthuy.jobflow.ui.auth

import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.core.common.fold
import me.dthuy.jobflow.core.mvi.MviViewModel
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.SignInMethod

/**
 * MVI: every command goes through one door. Each screen has its own instance, which holds only what is that screen's:
 * its error and its sign-in in progress. What every screen must agree on, the session and whether a command runs, is
 * the service's. No effects: navigation follows the session.
 */
@HiltViewModel
class AuthViewModel @Inject constructor(private val authentication: AuthenticationService) :
    MviViewModel<AuthState, AuthIntent, Nothing>(AuthState()) {
    private val signingIn = MutableStateFlow(false)
    private val error = MutableStateFlow<UiError?>(null)

    init {
        combine(authentication.session, authentication.isBusy, signingIn, error) { session, busy, signing, failed ->
            authState(session, running = busy || signing, failed)
        }.onEach { state -> setState { state } }.launchIn(viewModelScope)
    }

    override fun handleIntent(intent: AuthIntent) {
        when (intent) {
            is AuthIntent.SignInWithGoogle -> signInWithGoogle(intent)
            AuthIntent.ContinueAsGuest -> launchCommand { authentication.signIn(SignInMethod.Guest).report() }
            AuthIntent.SignOut -> launchCommand {
                authentication.signOut()
                error.value = null
            }
        }
    }

    // Runs here and not in a screen's scope: rotating the screen would cancel that scope and drop the result. Nothing
    // has started until there is a token, so leaving the screen with the sheet open simply signs nobody in.
    private fun signInWithGoogle(intent: AuthIntent.SignInWithGoogle) {
        if (signingIn.value || authentication.isBusy.value) return
        signingIn.value = true
        viewModelScope.launch {
            when (val result = intent.requestToken()) {
                is Either.Right -> result.value?.let { authentication.signIn(SignInMethod.Google(it)).report() }
                is Either.Left -> error.value = result.value.toUiError()
            }
        }.invokeOnCompletion { signingIn.value = false }
    }

    private fun launchCommand(command: suspend () -> Unit) {
        if (authentication.isBusy.value) return
        viewModelScope.launch { command() }
    }

    private fun Either<AuthError, Unit>.report() {
        error.value = fold(onLeft = AuthError::toUiError, onRight = { null })
    }
}
