package me.dthuy.jobflow.ui.health

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.sp
import kotlinx.collections.immutable.persistentListOf
import me.dthuy.jobflow.R
import me.dthuy.jobflow.ui.components.DetailRow
import me.dthuy.jobflow.ui.components.SectionLabel
import me.dthuy.jobflow.ui.components.SoftBadge
import me.dthuy.jobflow.ui.components.SoftButton
import me.dthuy.jobflow.ui.components.SoftCard
import me.dthuy.jobflow.ui.theme.JobFlowBlue
import me.dthuy.jobflow.ui.theme.JobFlowCoral
import me.dthuy.jobflow.ui.theme.JobFlowInk
import me.dthuy.jobflow.ui.theme.JobFlowMint
import me.dthuy.jobflow.ui.theme.JobFlowRed
import me.dthuy.jobflow.ui.theme.JobFlowSurface
import me.dthuy.jobflow.ui.theme.JobFlowYellow
import me.dthuy.jobflow.ui.theme.Spacing

@Composable
fun HealthSummaryCard(health: HealthUiState) {
    SoftCard(backgroundColor = health.kind.surfaceColor()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SectionLabel(stringResource(R.string.health_section_system))
            SoftBadge(text = health.kind.title(), backgroundColor = JobFlowSurface)
        }
        Text(text = health.headline(), color = JobFlowInk, fontSize = 18.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
fun ReadinessCard(health: HealthUiState) {
    SoftCard {
        SectionLabel(stringResource(R.string.health_section_readiness))
        DetailRow(stringResource(R.string.health_workspace), health.workspaceStatus.orUnknown())
        DetailRow(stringResource(R.string.health_scanner), health.scannerStatus.orUnknown())
    }
}

@Composable
fun HealthDetailsCard(health: HealthUiState, onCheckAgain: () -> Unit) {
    SoftCard {
        SectionLabel(stringResource(R.string.health_section_details))
        DetailRow(stringResource(R.string.health_wrapper), health.kind.wrapperLabel())
        DetailRow(stringResource(R.string.health_workspace), health.workspaceStatus.orUnknown())
        DetailRow(stringResource(R.string.health_scanner), health.scannerStatus.orUnknown())
        Text(
            text = stringResource(
                R.string.health_last_checked,
                health.checkedAtLabel ?: stringResource(R.string.health_not_checked_yet),
            ),
            color = JobFlowInk,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
        health.serverTime?.let {
            Text(
                text = stringResource(R.string.health_server_time, it),
                color = JobFlowInk,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
            )
        }
        SoftButton(
            onClick = onCheckAgain,
            enabled = health.kind != HealthUiKind.LOADING,
            containerColor = JobFlowBlue,
        ) {
            Text(stringResource(R.string.health_check_again), color = JobFlowInk, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun GuidanceCard(health: HealthUiState) {
    SoftCard(backgroundColor = JobFlowSurface) {
        SectionLabel(stringResource(R.string.health_section_guidance))
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            health.guidance.ifEmpty { listOf(health.headline()) }.forEach { item ->
                Text("[$item]", color = JobFlowInk, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun UnhealthyDialog(health: HealthUiState, onDismiss: () -> Unit, onOpenDetails: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.health_dialog_title), fontWeight = FontWeight.Black) },
        text = { Text(health.headline(), fontWeight = FontWeight.SemiBold) },
        confirmButton = {
            SoftButton(onClick = onOpenDetails, containerColor = JobFlowYellow) {
                Text(stringResource(R.string.health_dialog_details), color = JobFlowInk, fontWeight = FontWeight.Black)
            }
        },
        dismissButton = {
            SoftButton(onClick = onDismiss, containerColor = JobFlowSurface) {
                Text(stringResource(R.string.health_dialog_dismiss), color = JobFlowInk, fontWeight = FontWeight.Black)
            }
        },
    )
}

/** Server text wins; otherwise the first missing requirement; otherwise the copy for [HealthUiState.kind]. */
@Composable
fun HealthUiState.headline(): String = serverMessage
    ?: firstMissing?.let { stringResource(R.string.health_missing_requirement, it) }
    ?: kind.message()

@Composable
fun HealthUiKind.title(): String = stringResource(
    when (this) {
        HealthUiKind.LOADING -> R.string.health_title_loading
        HealthUiKind.READY -> R.string.health_title_ready
        HealthUiKind.NOT_READY -> R.string.health_title_not_ready
        HealthUiKind.UNREACHABLE -> R.string.health_title_unreachable
        HealthUiKind.PAIRING_REQUIRED -> R.string.health_title_pairing_required
        HealthUiKind.INVALID_RESPONSE -> R.string.health_title_invalid_response
    },
)

@Composable
fun HealthUiKind.message(): String = stringResource(
    when (this) {
        HealthUiKind.LOADING -> R.string.health_message_loading
        HealthUiKind.READY -> R.string.health_message_ready
        HealthUiKind.NOT_READY -> R.string.health_message_not_ready
        HealthUiKind.UNREACHABLE -> R.string.error_unreachable
        HealthUiKind.PAIRING_REQUIRED -> R.string.error_pairing_required
        HealthUiKind.INVALID_RESPONSE -> R.string.error_incompatible
    },
)

@Composable
private fun HealthUiKind.wrapperLabel(): String = stringResource(
    when (this) {
        HealthUiKind.UNREACHABLE -> R.string.health_wrapper_unreachable
        HealthUiKind.PAIRING_REQUIRED -> R.string.health_wrapper_pairing_required
        HealthUiKind.INVALID_RESPONSE -> R.string.health_wrapper_invalid_response
        HealthUiKind.LOADING, HealthUiKind.READY, HealthUiKind.NOT_READY -> R.string.health_wrapper_reachable
    },
)

@Composable
private fun String?.orUnknown(): String = this ?: stringResource(R.string.health_status_unknown)

private fun HealthUiKind.surfaceColor(): Color = when (this) {
    HealthUiKind.LOADING -> JobFlowBlue
    HealthUiKind.READY -> JobFlowMint
    HealthUiKind.NOT_READY -> JobFlowCoral
    HealthUiKind.UNREACHABLE, HealthUiKind.PAIRING_REQUIRED, HealthUiKind.INVALID_RESPONSE -> JobFlowRed
}

@Preview
@Composable
private fun HealthCardsPreview() {
    val health = HealthUiState(
        kind = HealthUiKind.NOT_READY,
        firstMissing = "workspace",
        checkedAtLabel = "09:05",
        workspaceStatus = "missing",
        scannerStatus = "notReady",
        guidance = persistentListOf("workspace", "doctor-script"),
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        HealthSummaryCard(health)
        HealthDetailsCard(health, onCheckAgain = {})
        GuidanceCard(health)
    }
}
