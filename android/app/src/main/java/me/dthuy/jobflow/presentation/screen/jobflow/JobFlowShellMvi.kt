package me.dthuy.jobflow.presentation.screen.jobflow

enum class JobFlowDestination {
    HOME,
    ADD,
    SETTINGS,
}

data class JobFlowShellUiState(
    val selectedDestination: JobFlowDestination = JobFlowDestination.HOME,
    val health: HealthUiState = HealthUiState(),
    val showHealthDialog: Boolean = false,
)

data class HealthUiState(
    val kind: HealthUiKind = HealthUiKind.LOADING,
    val title: String = "Checking",
    val message: String = "Checking local wrapper health.",
    val checkedAtMillis: Long? = null,
    val serverTime: String? = null,
    val workspaceStatus: String = "Unknown",
    val scannerStatus: String = "Unknown",
    val guidanceItems: List<String> = emptyList(),
)

enum class HealthUiKind {
    LOADING,
    READY,
    NOT_READY,
    UNREACHABLE,
    INVALID_RESPONSE,
}

sealed interface JobFlowShellIntent {
    data class SelectDestination(
        val destination: JobFlowDestination,
    ) : JobFlowShellIntent

    data object CheckAgain : JobFlowShellIntent

    data object DismissHealthDialog : JobFlowShellIntent

    data object OpenHealthDetails : JobFlowShellIntent
}
