package me.dthuy.jobflow.ui.settings

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import me.dthuy.jobflow.R
import me.dthuy.jobflow.domain.model.ThemeMode
import me.dthuy.jobflow.ui.components.JobFlowPage
import me.dthuy.jobflow.ui.components.SectionLabel
import me.dthuy.jobflow.ui.components.SoftCard
import me.dthuy.jobflow.ui.health.GuidanceCard
import me.dthuy.jobflow.ui.health.HealthDetailsCard
import me.dthuy.jobflow.ui.health.HealthSummaryCard
import me.dthuy.jobflow.ui.theme.JobFlowInk
import me.dthuy.jobflow.ui.theme.Spacing

@Composable
fun SettingsScreen(contentPadding: PaddingValues, viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    SettingsContent(
        state = state,
        contentPadding = contentPadding,
        onThemeModeSelected = viewModel::onThemeModeSelected,
        onCheckAgain = viewModel::onCheckAgain,
    )
}

@Composable
fun SettingsContent(
    state: SettingsUiState,
    contentPadding: PaddingValues,
    onThemeModeSelected: (ThemeMode) -> Unit,
    onCheckAgain: () -> Unit,
    modifier: Modifier = Modifier,
) {
    JobFlowPage(title = stringResource(R.string.settings_title), contentPadding = contentPadding, modifier = modifier) {
        HealthSummaryCard(state.health)
        HealthDetailsCard(state.health, onCheckAgain = onCheckAgain)
        GuidanceCard(state.health)
        SoftCard {
            SectionLabel(stringResource(R.string.settings_theme).uppercase())
            ThemeMode.entries.forEach { mode ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .selectable(
                            selected = state.themeMode == mode,
                            role = Role.RadioButton,
                            onClick = { onThemeModeSelected(mode) },
                        )
                        .padding(vertical = Spacing.xs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = state.themeMode == mode, onClick = null)
                    Text(stringResource(mode.labelRes()), color = JobFlowInk, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

private fun ThemeMode.labelRes(): Int = when (this) {
    ThemeMode.System -> R.string.settings_theme_system
    ThemeMode.Light -> R.string.settings_theme_light
    ThemeMode.Dark -> R.string.settings_theme_dark
}

@Preview
@Composable
private fun SettingsContentPreview() {
    SettingsContent(
        state = SettingsUiState(),
        contentPadding = PaddingValues(),
        onThemeModeSelected = {},
        onCheckAgain = {},
    )
}
