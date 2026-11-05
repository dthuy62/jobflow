package me.dthuy.jobflow.ui.settings

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import me.dthuy.jobflow.core.common.fold
import me.dthuy.jobflow.domain.auth.AuthRepository
import me.dthuy.jobflow.domain.repository.AccountRepository
import me.dthuy.jobflow.domain.repository.HealthRepository
import me.dthuy.jobflow.ui.components.toUiError
import me.dthuy.jobflow.ui.health.HealthUiKind
import me.dthuy.jobflow.ui.health.HealthUiState
import me.dthuy.jobflow.ui.health.toHealthUiState

@Immutable
data class SettingsUiState(
    val health: HealthUiState = HealthUiState(),
    val accountCheck: AccountCheck = AccountCheck.Idle,
)

/**
 * MVVM-lite: one UiState exposed as StateFlow, user actions are plain functions.
 * No intent classes and no effects, because this screen has neither complex state nor one-shot events.
 * It talks to the repository directly: a use case here would be a pass-through.
 * Signing in belongs to `AuthViewModel`; this only asks the API about whoever the session says is signed in.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val healthRepository: HealthRepository,
    private val authRepository: AuthRepository,
    private val accountRepository: AccountRepository,
) : ViewModel() {
    private val refreshing = MutableStateFlow(false)
    private val accountCheck = MutableStateFlow<AccountCheck>(AccountCheck.Idle)
    private var retry: Job? = null

    val uiState: StateFlow<SettingsUiState> =
        combine(healthRepository.latest, refreshing, accountCheck) { snapshot, isRefreshing, check ->
            val health = snapshot.toHealthUiState()
            SettingsUiState(
                health = if (isRefreshing) health.copy(kind = HealthUiKind.LOADING) else health,
                accountCheck = check,
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), SettingsUiState())

    init {
        viewModelScope.launch {
            authRepository.session.collectLatest { session ->
                // A new session owes nothing to the old one's check, whether finished or still running.
                retry?.cancel()
                accountCheck.value = AccountCheck.Idle
                if (session.isSignedIn) {
                    val result = askTheApi()
                    accountCheck.update { if (it == AccountCheck.Running) it else result }
                }
            }
        }
    }

    // Set before the first suspension, so a second tap cannot start a second check.
    fun onRetryAccount() {
        val before = accountCheck.value
        if (before == AccountCheck.Running) return
        accountCheck.value = AccountCheck.Running
        retry = viewModelScope.launch { accountCheck.value = askTheApi() }
        retry?.invokeOnCompletion {
            // A task cancelled from outside ends the check with no result, and Running would block all later ones.
            accountCheck.update { if (it == AccountCheck.Running) before else it }
        }
    }

    private suspend fun askTheApi(): AccountCheck = accountRepository.account().fold(
        onLeft = { AccountCheck.Failed(it.toUiError()) },
        onRight = { AccountCheck.Idle },
    )

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
