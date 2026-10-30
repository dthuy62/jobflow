package me.dthuy.jobflow.ui.home

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import me.dthuy.jobflow.R
import me.dthuy.jobflow.core.mvi.CollectEffects
import me.dthuy.jobflow.ui.components.JobFlowPage
import me.dthuy.jobflow.ui.components.SectionLabel
import me.dthuy.jobflow.ui.components.SoftButton
import me.dthuy.jobflow.ui.components.SoftCard
import me.dthuy.jobflow.ui.health.HealthSummaryCard
import me.dthuy.jobflow.ui.health.HealthUiKind
import me.dthuy.jobflow.ui.health.HealthUiState
import me.dthuy.jobflow.ui.health.ReadinessCard
import me.dthuy.jobflow.ui.health.UnhealthyDialog
import me.dthuy.jobflow.ui.theme.JobFlowInk
import me.dthuy.jobflow.ui.theme.JobFlowMint
import me.dthuy.jobflow.ui.theme.JobFlowYellow

@Composable
fun HomeScreen(
    contentPadding: PaddingValues,
    onOpenSettings: () -> Unit,
    onOpenInputs: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    CollectEffects(viewModel.effects) { effect ->
        when (effect) {
            HomeEffect.NavigateToSettings -> onOpenSettings()
            HomeEffect.NavigateToInputs -> onOpenInputs()
        }
    }
    HomeContent(state = state, contentPadding = contentPadding, onIntent = viewModel::onIntent)
}

@Composable
fun HomeContent(
    state: HomeState,
    contentPadding: PaddingValues,
    onIntent: (HomeIntent) -> Unit,
    modifier: Modifier = Modifier,
) {
    JobFlowPage(title = stringResource(R.string.home_title), contentPadding = contentPadding, modifier = modifier) {
        HealthSummaryCard(state.health)
        SoftCard(backgroundColor = JobFlowYellow) {
            SectionLabel(stringResource(R.string.home_next_action))
            Text(
                text = stringResource(R.string.home_next_action_title),
                color = JobFlowInk,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                text = stringResource(R.string.home_next_action_body),
                color = JobFlowInk,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            SoftButton(onClick = { onIntent(HomeIntent.OpenInputs) }, containerColor = JobFlowMint) {
                Text(stringResource(R.string.home_open_inputs), color = JobFlowInk, fontWeight = FontWeight.Black)
            }
        }
        ReadinessCard(state.health)
    }

    if (state.showUnhealthyDialog) {
        UnhealthyDialog(
            health = state.health,
            onDismiss = { onIntent(HomeIntent.DismissDialog) },
            onOpenDetails = { onIntent(HomeIntent.OpenHealthDetails) },
        )
    }
}

@Preview
@Composable
private fun HomeContentPreview() {
    HomeContent(
        state = HomeState(health = HealthUiState(kind = HealthUiKind.READY, workspaceStatus = "ready")),
        contentPadding = PaddingValues(),
        onIntent = {},
    )
}
