package me.dthuy.jobflow.ui.settings

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.UiError
import me.dthuy.jobflow.core.common.fold
import me.dthuy.jobflow.core.common.leftOrNull
import me.dthuy.jobflow.core.common.mapLeft
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthRepository
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.repository.AccountRepository
import me.dthuy.jobflow.domain.repository.HealthRepository
import me.dthuy.jobflow.ui.auth.toUiError
import me.dthuy.jobflow.ui.components.toUiError
import me.dthuy.jobflow.ui.health.HealthUiKind
import me.dthuy.jobflow.ui.health.HealthUiState
import me.dthuy.jobflow.ui.health.toHealthUiState

@Immutable
data class SettingsUiState(val health: HealthUiState = HealthUiState(), val account: AccountUiState = AccountUiState())

/**
 * MVVM-lite: one UiState exposed as StateFlow, user actions are plain functions.
 * No intent classes and no effects, because this screen has neither complex state nor one-shot events.
 * It talks to the repository directly: a use case here would be a pass-through.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val healthRepository: HealthRepository,
    private val authRepository: AuthRepository,
    private val accountRepository: AccountRepository,
) : ViewModel() {
    private val refreshing = MutableStateFlow(false)
    private val activity = MutableStateFlow<AccountActivity>(AccountActivity.Idle)

    val uiState: StateFlow<SettingsUiState> = combine(
        healthRepository.latest,
        refreshing,
        authRepository.session,
        activity,
    ) { snapshot, isRefreshing, session, accountActivity ->
        val health = snapshot.toHealthUiState()
        SettingsUiState(
            health = if (isRefreshing) health.copy(kind = HealthUiKind.LOADING) else health,
            account = accountUiState(session, accountActivity),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), SettingsUiState())

    init {
        viewModelScope.launch {
            authRepository.session.collectLatest { session ->
                if (session.isSignedIn) checkAccount()
            }
        }
    }

    fun onRetryAccount() = runAction { recheckAccount() }

    /**
     * Runs [requestToken] here and not in a screen's scope: rotating the screen would cancel that scope and drop the
     * result. A null token means the user closed Google's sheet, so everything stays as it was.
     */
    fun onSignIn(requestToken: suspend () -> Either<AuthError, IdToken?>) = runAction { before ->
        requestToken().fold(
            onLeft = { AccountActivity.ActionFailed(it.toUiError()) },
            onRight = { token -> if (token == null) before else signIn(token) },
        )
    }

    fun onContinueAsGuest() = runAction { authRepository.continueAsGuest().mapLeft(AuthError::toUiError).toActivity() }

    fun onSignOut() = runAction {
        authRepository.signOut()
        AccountActivity.Idle
    }

    // A member signing in again can stay the same user, which changes no session, so nothing else would ask the API.
    private suspend fun signIn(token: IdToken): AccountActivity {
        val wasMember = authRepository.session.value is Session.Member
        return authRepository.signInWithGoogle(token).fold(
            onLeft = { AccountActivity.ActionFailed(it.toUiError()) },
            onRight = { if (wasMember) recheckAccount() else AccountActivity.Idle },
        )
    }

    private suspend fun recheckAccount(): AccountActivity =
        accountRepository.account().mapLeft(AppError::toUiError).toActivity(AccountActivity::CheckFailed)

    // Set before the first suspension, so a second tap cannot start a second action.
    private fun runAction(action: suspend (before: AccountActivity) -> AccountActivity) {
        val before = activity.value
        if (before == AccountActivity.Running) return
        activity.value = AccountActivity.Running
        viewModelScope.launch { activity.value = action(before) }.invokeOnCompletion {
            // A task cancelled from outside ends the action with no result, and Running would block all later ones.
            activity.update { if (it == AccountActivity.Running) before else it }
        }
    }

    private fun Either<UiError, *>.toActivity(
        toFailure: (UiError) -> AccountActivity = AccountActivity::ActionFailed,
    ): AccountActivity = fold(onLeft = toFailure, onRight = { AccountActivity.Idle })

    // A running sign-in is about to change the token this depends on, and owns the activity until it ends.
    private suspend fun checkAccount() {
        activity.first { it != AccountActivity.Running }
        val failure = accountRepository.account().leftOrNull()?.toUiError()
        activity.update { current ->
            when {
                current is AccountActivity.ActionFailed || current == AccountActivity.Running -> current
                failure != null -> AccountActivity.CheckFailed(failure)
                else -> AccountActivity.Idle
            }
        }
    }

    fun onCheckAgain() {
        if (refreshing.value) return
        viewModelScope.launch {
            refreshing.value = true
            healthRepository.refresh(force = true)
            refreshing.value = false
        }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
