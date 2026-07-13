package me.dthuy.jobflow.presentation.screen.jobflow

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import me.dthuy.jobflow.core.Either
import me.dthuy.jobflow.core.NetworkError
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.domain.usecase.CheckHealthUseCase
import me.dthuy.jobflow.domain.usecase.HealthCheckSnapshot

class JobFlowShellViewModel(
    private val checkHealthUseCase: CheckHealthUseCase,
) : ViewModel() {
    private val _state = MutableStateFlow(JobFlowShellUiState())
    val state: StateFlow<JobFlowShellUiState> = _state.asStateFlow()
    private var refreshJob: Job? = null

    init {
        refreshHealth(forceRefresh = false)
    }

    fun handleIntent(intent: JobFlowShellIntent) {
        when (intent) {
            is JobFlowShellIntent.SelectDestination -> {
                _state.update { it.copy(selectedDestination = intent.destination) }
            }

            JobFlowShellIntent.CheckAgain -> {
                refreshHealth(forceRefresh = true)
            }

            JobFlowShellIntent.DismissHealthDialog -> {
                checkHealthUseCase.dismissUnhealthyDialog()
                _state.update { it.copy(showHealthDialog = false) }
            }

            JobFlowShellIntent.OpenHealthDetails -> {
                checkHealthUseCase.dismissUnhealthyDialog()
                _state.update {
                    it.copy(
                        selectedDestination = JobFlowDestination.SETTINGS,
                        showHealthDialog = false,
                    )
                }
            }
        }
    }

    private fun refreshHealth(forceRefresh: Boolean) {
        refreshJob?.cancel()
        _state.update { it.copy(health = it.health.copy(kind = HealthUiKind.LOADING, title = "Checking")) }
        refreshJob =
            viewModelScope.launch {
                val snapshot = checkHealthUseCase(forceRefresh = forceRefresh)
                _state.update {
                    it.copy(
                        health = snapshot.toUiState(),
                        showHealthDialog = checkHealthUseCase.shouldShowUnhealthyDialog(),
                    )
                }
            }
    }
}

private fun HealthCheckSnapshot.toUiState(): HealthUiState =
    when (val healthResult = result) {
        is Either.Right -> healthResult.value.toUiState(checkedAtMillis)
        is Either.Left -> healthResult.value.toUiState(checkedAtMillis)
    }

private fun Health.toUiState(checkedAtMillis: Long): HealthUiState {
    val missing = workspace.missingRequirements + careerOps.scanner.missingRequirements
    val messages = workspace.messages + careerOps.scanner.messages
    val isReady = status == HealthStatus.READY
    val message =
        messages.firstOrNull()
            ?: missing.firstOrNull()?.let { "Missing: $it" }
            ?: if (isReady) "Wrapper and workspace are ready." else "Local setup is not ready."
    val guidanceItems = (missing + messages).ifEmpty { listOf(message) }
    return HealthUiState(
        kind = if (isReady) HealthUiKind.READY else HealthUiKind.NOT_READY,
        title = if (isReady) "Ready" else "Needs setup",
        message = message,
        checkedAtMillis = checkedAtMillis,
        serverTime = serverTime,
        workspaceStatus = workspace.status.wireValue,
        scannerStatus = careerOps.scanner.status.wireValue,
        guidanceItems = guidanceItems,
    )
}

private fun NetworkError.toUiState(checkedAtMillis: Long): HealthUiState =
    when (this) {
        is NetworkError.IOExceptionError -> {
            HealthUiState(
                kind = HealthUiKind.UNREACHABLE,
                title = "Unreachable",
                message = "Cannot reach the local wrapper. Start it and try again.",
                checkedAtMillis = checkedAtMillis,
            )
        }

        NetworkError.EmptyBody,
        is NetworkError.HttpError,
        is NetworkError.Unknown,
        -> {
            HealthUiState(
                kind = HealthUiKind.INVALID_RESPONSE,
                title = "Invalid response",
                message = "The wrapper answered in an unexpected format.",
                checkedAtMillis = checkedAtMillis,
            )
        }
    }

private fun Any.toUiState(checkedAtMillis: Long): HealthUiState =
    if (this is NetworkError) {
        toUiState(checkedAtMillis)
    } else {
        HealthUiState(
            kind = HealthUiKind.INVALID_RESPONSE,
            title = "Invalid response",
            message = "The wrapper answered in an unexpected format.",
            checkedAtMillis = checkedAtMillis,
        )
    }

class JobFlowShellViewModelFactory(
    private val checkHealthUseCase: CheckHealthUseCase,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(JobFlowShellViewModel::class.java)) {
            return JobFlowShellViewModel(checkHealthUseCase) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
