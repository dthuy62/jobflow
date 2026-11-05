package me.dthuy.jobflow.ui.home

import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import me.dthuy.jobflow.core.mvi.MviViewModel
import me.dthuy.jobflow.domain.model.HealthSnapshot
import me.dthuy.jobflow.domain.repository.HealthRepository
import me.dthuy.jobflow.ui.health.HealthUiKind
import me.dthuy.jobflow.ui.health.toHealthUiState

/**
 * MVI: health refresh, the show-once dialog and navigation effects interact. Home is always the bottom entry of the
 * back stack, so this ViewModel (and its dialog flag) lives as long as the app's main screen.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(private val repository: HealthRepository) :
    MviViewModel<HomeState, HomeIntent, HomeEffect>(HomeState()) {
    private var refreshJob: Job? = null

    init {
        // Checks started from other screens (Settings) land here too.
        repository.latest.filterNotNull().onEach(::show).launchIn(viewModelScope)
        refresh(force = false)
    }

    override fun handleIntent(intent: HomeIntent) {
        when (intent) {
            HomeIntent.CheckAgain -> refresh(force = true)
            HomeIntent.DismissDialog -> consumeDialog()
            HomeIntent.OpenHealthDetails -> {
                consumeDialog()
                sendEffect(HomeEffect.NavigateToSettings)
            }
            HomeIntent.OpenInputs -> sendEffect(HomeEffect.NavigateToInputs)
        }
    }

    private fun refresh(force: Boolean) {
        refreshJob?.cancel()
        setState { copy(health = health.copy(kind = HealthUiKind.LOADING)) }
        // A cached answer does not change `latest`, so the returned snapshot is shown as well.
        refreshJob = viewModelScope.launch { show(repository.refresh(force)) }
    }

    private fun show(snapshot: HealthSnapshot) {
        val health = snapshot.toHealthUiState()
        setState { copy(health = health, showUnhealthyDialog = health.isUnhealthy && !unhealthyDialogConsumed) }
    }

    private fun consumeDialog() = setState { copy(showUnhealthyDialog = false, unhealthyDialogConsumed = true) }
}
