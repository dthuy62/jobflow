package me.dthuy.jobflow.ui.settings

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import me.dthuy.jobflow.domain.repository.HealthRepository
import me.dthuy.jobflow.ui.health.HealthUiKind
import me.dthuy.jobflow.ui.health.HealthUiState
import me.dthuy.jobflow.ui.health.toHealthUiState

@Immutable
data class SettingsUiState(val health: HealthUiState = HealthUiState())

/**
 * MVVM-lite: one UiState exposed as StateFlow, user actions are plain functions.
 * No intent classes and no effects, because this screen has neither complex state nor one-shot events.
 * It talks to the repository directly: a use case here would be a pass-through.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(private val healthRepository: HealthRepository) : ViewModel() {
    private val refreshing = MutableStateFlow(false)

    val uiState: StateFlow<SettingsUiState> =
        combine(healthRepository.latest, refreshing) { snapshot, isRefreshing ->
            val health = snapshot.toHealthUiState()
            SettingsUiState(health = if (isRefreshing) health.copy(kind = HealthUiKind.LOADING) else health)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), SettingsUiState())

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
