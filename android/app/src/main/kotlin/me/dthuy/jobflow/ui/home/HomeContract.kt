package me.dthuy.jobflow.ui.home

import androidx.compose.runtime.Immutable
import me.dthuy.jobflow.core.mvi.UiEffect
import me.dthuy.jobflow.core.mvi.UiIntent
import me.dthuy.jobflow.core.mvi.UiState
import me.dthuy.jobflow.ui.health.HealthUiState

@Immutable
data class HomeState(
    val health: HealthUiState = HealthUiState(),
    val showUnhealthyDialog: Boolean = false,
    /** Set once the user dismissed or followed the dialog; it then stays hidden for this ViewModel's lifetime. */
    val unhealthyDialogConsumed: Boolean = false,
) : UiState

sealed interface HomeIntent : UiIntent {
    data object CheckAgain : HomeIntent

    data object DismissDialog : HomeIntent

    data object OpenHealthDetails : HomeIntent

    data object OpenInputs : HomeIntent
}

sealed interface HomeEffect : UiEffect {
    data object NavigateToSettings : HomeEffect

    data object NavigateToInputs : HomeEffect
}
