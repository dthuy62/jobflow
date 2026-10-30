package me.dthuy.jobflow.ui.settings

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import me.dthuy.jobflow.R
import me.dthuy.jobflow.ui.components.JobFlowPage
import me.dthuy.jobflow.ui.health.GuidanceCard
import me.dthuy.jobflow.ui.health.HealthDetailsCard
import me.dthuy.jobflow.ui.health.HealthSummaryCard

@Composable
fun SettingsScreen(contentPadding: PaddingValues, viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    SettingsContent(state = state, contentPadding = contentPadding, onCheckAgain = viewModel::onCheckAgain)
}

@Composable
fun SettingsContent(
    state: SettingsUiState,
    contentPadding: PaddingValues,
    onCheckAgain: () -> Unit,
    modifier: Modifier = Modifier,
) {
    JobFlowPage(title = stringResource(R.string.settings_title), contentPadding = contentPadding, modifier = modifier) {
        HealthSummaryCard(state.health)
        HealthDetailsCard(state.health, onCheckAgain = onCheckAgain)
        GuidanceCard(state.health)
    }
}

@Preview
@Composable
private fun SettingsContentPreview() {
    SettingsContent(state = SettingsUiState(), contentPadding = PaddingValues(), onCheckAgain = {})
}
