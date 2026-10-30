package me.dthuy.jobflow.ui.settings

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import me.dthuy.jobflow.domain.model.ThemeMode
import me.dthuy.jobflow.domain.repository.SettingsRepository

@Immutable
data class SettingsUiState(val themeMode: ThemeMode = ThemeMode.System)

/**
 * MVVM-lite: one UiState exposed as StateFlow, user actions are plain functions.
 * No intent classes and no effects, because this screen has neither complex state nor one-shot events.
 * It talks to the repository directly: a use case here would be a pass-through.
 */
@HiltViewModel
class SettingsViewModel @Inject constructor(private val repository: SettingsRepository) : ViewModel() {
    val uiState: StateFlow<SettingsUiState> =
        repository.themeMode
            .map { SettingsUiState(themeMode = it) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS), SettingsUiState())

    fun onThemeModeSelected(mode: ThemeMode) {
        viewModelScope.launch { repository.setThemeMode(mode) }
    }

    private companion object {
        const val STOP_TIMEOUT_MS = 5_000L
    }
}
