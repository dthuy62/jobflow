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
import me.dthuy.jobflow.domain.model.ThemeMode
import me.dthuy.jobflow.domain.repository.HealthRepository
import me.dthuy.jobflow.domain.repository.SettingsRepository
import me.dthuy.jobflow.ui.health.HealthUiKind
import me.dthuy.jobflow.ui.health.HealthUiState
import me.dthuy.jobflow.ui.health.toHealthUiState

@Immutable
data class SettingsUiState(val themeMode: ThemeMode = ThemeMode.System, val health: HealthUiState = HealthUiState())

/**
 * MVVM-lite: one UiState exposed as StateFlow, user actions are plain functions.
 * No intent classes and no effects, because this screen has neither complex state nor one-shot events.
 * It talks to the repositories directly: a use case here would be a pass-through.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repository: SettingsRepository,
    private val healthRepository: HealthRepository,
) : ViewModel() {
    private val refreshing = MutableStateFlow(false)

    val uiState: StateFlow<SettingsUiState> =
        combine(repository.themeMode, healthRepository.latest, refreshing) { themeMode, snapshot, isRefreshing ->
            val health = snapshot.toHealthUiState()
            SettingsUiState(
                themeMode = themeMode,
                health = if (isRefreshing) health.copy(kind = HealthUiKind.LOADING) else health,
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), SettingsUiState())

    fun onThemeModeSelected(mode: ThemeMode) {
        viewModelScope.launch { repository.setThemeMode(mode) }
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
